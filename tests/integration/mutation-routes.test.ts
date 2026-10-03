import { beforeEach, describe, expect, it } from "vitest";

import { POST as redeem } from "../../app/api/v1/redemptions/route";
import { POST as createSession } from "../../app/api/v1/session/demo/route";
import { POST as visit } from "../../app/api/v1/visits/route";
import { resetUserData } from "../helpers/supabase";

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  return resetUserData();
});

describe("mutation routes", () => {
  it("requires authentication, an allowed origin, and an idempotency key", async () => {
    const body = visitBody();
    expect((await visit(request("/api/v1/visits", body, "key", undefined))).status).toBe(401);
    const cookie = await sessionCookie();
    const blocked = await visit(request("/api/v1/visits", body, "key", cookie, "https://evil.example"));
    expect(await errorCode(blocked)).toBe("ORIGIN_FORBIDDEN");
    const missingKey = await visit(request("/api/v1/visits", body, undefined, cookie));
    expect(await errorCode(missingKey)).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("blocks simulated mutations when demo mode is disabled", async () => {
    const cookie = await sessionCookie();
    process.env.DEMO_MODE = "false";
    const response = await visit(request("/api/v1/visits", visitBody(), "key", cookie));
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("DEMO_MODE_DISABLED");
  });

  it.each([
    ["LOCATION_STALE", { capturedAt: new Date(Date.now() - 61_000).toISOString() }],
    ["LOCATION_INACCURATE", { accuracyMeters: 101 }],
    ["LOCATION_IN_FUTURE", { capturedAt: new Date(Date.now() + 6_000).toISOString() }],
    ["LOCATION_TOO_FAR", { latitude: 37.77 }],
  ])("rejects %s", async (code, locationPatch) => {
    const cookie = await sessionCookie();
    const body = visitBody();
    body.location = { ...body.location, ...locationPatch };
    const response = await visit(request("/api/v1/visits", body, `key-${code}`, cookie));
    expect(await errorCode(response)).toBe(code);
  });

  it("rejects malformed purchases, unknown venues, and client award overrides", async () => {
    const cookie = await sessionCookie();
    const small = visitBody();
    small.demoPurchase.billCents = 499;
    expect(await errorCode(await visit(request("/api/v1/visits", small, "small", cookie)))).toBe("PURCHASE_TOO_SMALL");
    expect(await errorCode(await visit(request("/api/v1/visits", { ...visitBody(), restaurantId: "missing" }, "missing", cookie)))).toBe("RESTAURANT_NOT_FOUND");
    expect(await errorCode(await visit(request("/api/v1/visits", { ...visitBody(), xpAwarded: 1200 }, "override", cookie)))).toBe("INVALID_REQUEST");
  });

  it("awards once, replays exactly, rejects conflicts, and prevents receipt reuse", async () => {
    const cookie = await sessionCookie();
    const body = visitBody("receipt-a");
    const first = await visit(request("/api/v1/visits", body, "same-key", cookie));
    const firstJson = await first.json();
    expect(first.status).toBe(201);
    expect(firstJson).toMatchObject({ firstDiscovery: true, xpAwarded: 150, creditAwardedCents: 50, summary: { balanceCents: 50 } });
    const replay = await visit(request("/api/v1/visits", body, "same-key", cookie));
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(firstJson);
    const changed = { ...body, demoPurchase: { ...body.demoPurchase, billCents: 600 } };
    expect(await errorCode(await visit(request("/api/v1/visits", changed, "same-key", cookie)))).toBe("IDEMPOTENCY_CONFLICT");
    const reused = { ...visitBody("receipt-a"), restaurantId: "demo-soma-curry", location: locationAt(37.7782, -122.4003) };
    expect(await errorCode(await visit(request("/api/v1/visits", reused, "new-key", cookie)))).toBe("RECEIPT_ALREADY_USED");
  });

  it("earns 50 cents at A, redeems 30 at B, and replays to a 20-cent balance", async () => {
    const cookie = await sessionCookie();
    expect((await visit(request("/api/v1/visits", visitBody("earn-a"), "earn-key", cookie))).status).toBe(201);
    const redemption = { restaurantId: "demo-sunset-ramen", demoReceiptId: "redeem-b", billCents: 500, amountCents: 30 };
    const first = await redeem(request("/api/v1/redemptions", redemption, "redeem-key", cookie));
    const firstJson = await first.json();
    expect(first.status).toBe(201);
    expect(firstJson).toMatchObject({ amountCents: 30, settlementStatus: "simulated", summary: { balanceCents: 20, totalXp: 150 } });
    const replay = await redeem(request("/api/v1/redemptions", redemption, "redeem-key", cookie));
    expect(await replay.json()).toEqual(firstJson);
  });

  it("enforces portability, amount limits, and concurrent balance safety", async () => {
    const cookie = await sessionCookie();
    await visit(request("/api/v1/visits", visitBody("earn-a"), "earn-key", cookie));
    const sameVenue = { restaurantId: "demo-mission-taco", demoReceiptId: "same", billCents: 500, amountCents: 30 };
    expect(await errorCode(await redeem(request("/api/v1/redemptions", sameVenue, "same", cookie)))).toBe("PORTABILITY_REQUIRED");
    const tooMuch = { restaurantId: "demo-sunset-ramen", demoReceiptId: "large", billCents: 600, amountCents: 501 };
    expect(await errorCode(await redeem(request("/api/v1/redemptions", tooMuch, "large", cookie)))).toBe("INVALID_REQUEST");
    const [a, b] = await Promise.all([
      redeem(request("/api/v1/redemptions", { restaurantId: "demo-sunset-ramen", demoReceiptId: "a", billCents: 500, amountCents: 40 }, "a", cookie)),
      redeem(request("/api/v1/redemptions", { restaurantId: "demo-sunset-ramen", demoReceiptId: "b", billCents: 500, amountCents: 40 }, "b", cookie)),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });
});

function visitBody(receiptId = crypto.randomUUID()) {
  return { restaurantId: "demo-mission-taco", location: locationAt(37.7599, -122.4148), demoPurchase: { receiptId, billCents: 500 } };
}

function locationAt(latitude: number, longitude: number) {
  return { latitude, longitude, accuracyMeters: 10, capturedAt: new Date().toISOString() };
}

function request(path: string, body: unknown, key?: string, cookie?: string, origin = "http://localhost:3000") {
  const headers = new Headers({ "content-type": "application/json", origin });
  if (key) headers.set("idempotency-key", key);
  if (cookie) headers.set("cookie", cookie.split(";", 1)[0]);
  return new Request(`http://localhost:3000${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function sessionCookie() {
  const response = await createSession(new Request("http://localhost:3000/api/v1/session/demo", { method: "POST", headers: { origin: "http://localhost:3000" } }));
  return response.headers.get("set-cookie") ?? "";
}

async function errorCode(response: Response): Promise<string> {
  return (await response.json()).error.code;
}

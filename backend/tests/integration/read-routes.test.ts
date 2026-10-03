import { beforeEach, describe, expect, it } from "vitest";

import { GET as getCollection } from "../../app/api/v1/collection/route";
import { GET as getMe } from "../../app/api/v1/me/route";
import { GET as getNearby } from "../../app/api/v1/restaurants/nearby/route";
import { POST as createSession } from "../../app/api/v1/session/demo/route";
import { GET as getWallet } from "../../app/api/v1/wallet/route";
import { consumeRateLimit } from "../../lib/server/rate-limit";
import { requireSession } from "../../lib/server/session";
import { admin, resetUserData, visit } from "../helpers/supabase";

beforeEach(resetUserData);

describe("session and read routes", () => {
  it("returns 401 without a demo session", async () => {
    const response = await getMe(new Request("http://localhost:3000/api/v1/me"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("creates and resumes an isolated HttpOnly session", async () => {
    const first = await createSession(writeRequest("/api/v1/session/demo"));
    const cookie = first.headers.get("set-cookie") ?? "";
    expect(first.status).toBe(200);
    expect(cookie).toContain("bitequest_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).not.toContain("Secure");
    const firstBody = await first.json();
    expect(firstBody.summary).toMatchObject({ totalXp: 0, balanceCents: 0, rewardFunding: "platform" });

    const second = await createSession(writeRequest("/api/v1/session/demo", cookieHeader(cookie)));
    expect((await second.json()).sessionId).toBe(firstBody.sessionId);
  });

  it("returns authoritative nearby, collection, wallet, and summary data", async () => {
    const cookie = await sessionCookie();
    const authRequest = new Request("http://localhost:3000/api/v1/me", { headers: cookieHeader(cookie) });
    const session = await requireSession(authRequest);
    await visit(session.userId, { receiptId: "read-route-visit" });

    const me = await getMe(authRequest);
    expect(await me.json()).toMatchObject({ totalXp: 150, balanceCents: 50 });

    const nearby = await getNearby(new Request("http://localhost:3000/api/v1/restaurants/nearby?latitude=37.7599&longitude=-122.4148&radiusMeters=5000", { headers: cookieHeader(cookie) }));
    const nearbyBody = await nearby.json();
    expect(nearbyBody.restaurants[0]).toMatchObject({ id: "demo-mission-taco", distanceMeters: 0, discovered: true, rewardEligibleToday: false });
    expect(nearbyBody.restaurants.map((restaurant: { distanceMeters: number }) => restaurant.distanceMeters)).toEqual(
      [...nearbyBody.restaurants].map((restaurant: { distanceMeters: number }) => restaurant.distanceMeters).sort((a: number, b: number) => a - b),
    );

    const collection = await getCollection(new Request("http://localhost:3000/api/v1/collection", { headers: cookieHeader(cookie) }));
    expect(await collection.json()).toMatchObject({ count: 1, discoveries: [{ restaurant: { id: "demo-mission-taco" } }] });

    const wallet = await getWallet(new Request("http://localhost:3000/api/v1/wallet", { headers: cookieHeader(cookie) }));
    expect(await wallet.json()).toMatchObject({ summary: { balanceCents: 50 }, transactions: [{ kind: "earn", deltaCents: 50 }] });
  });

  it("returns at most 50 wallet transactions while preserving the complete balance", async () => {
    const cookie = await sessionCookie();
    const session = await requireSession(new Request("http://localhost:3000/api/v1/me", { headers: cookieHeader(cookie) }));
    const rows = Array.from({ length: 51 }, () => ({
      user_id: session.userId,
      restaurant_id: "demo-mission-taco",
      kind: "earn",
      delta_cents: 1,
      reference_id: crypto.randomUUID(),
    }));
    expect((await admin.from("wallet_transactions").insert(rows)).error).toBeNull();
    const response = await getWallet(new Request("http://localhost:3000/api/v1/wallet", { headers: cookieHeader(cookie) }));
    const body = await response.json();
    expect(body.transactions).toHaveLength(50);
    expect(body.summary.balanceCents).toBe(51);
  });

  it("uses a durable per-user rate limit", async () => {
    const cookie = await sessionCookie();
    const session = await requireSession(new Request("http://localhost:3000/api/v1/me", { headers: cookieHeader(cookie) }));
    await expect(consumeRateLimit(session.userId, "planning", 2)).resolves.toBe(true);
    await expect(consumeRateLimit(session.userId, "planning", 2)).resolves.toBe(true);
    await expect(consumeRateLimit(session.userId, "planning", 2)).resolves.toBe(false);
  });
});

function writeRequest(path: string, headers: HeadersInit = {}) {
  return new Request(`http://localhost:3000${path}`, { method: "POST", headers: { origin: "http://localhost:3000", ...headers } });
}

function cookieHeader(setCookie: string): Record<string, string> {
  return { cookie: setCookie.split(";", 1)[0] };
}

async function sessionCookie(): Promise<string> {
  return (await createSession(writeRequest("/api/v1/session/demo"))).headers.get("set-cookie") ?? "";
}

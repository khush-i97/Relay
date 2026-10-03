import { describe, expect, it } from "vitest";

import { ApiProblem } from "../../lib/server/errors";
import { jsonError, sanitizeLog } from "../../lib/server/http";
import { validateWriteOrigin } from "../../lib/server/origin";

describe("HTTP infrastructure", () => {
  it("returns the shared error envelope and status", async () => {
    const response = jsonError(new ApiProblem("UNAUTHENTICATED", "Sign in", { retryable: false }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: { code: "UNAUTHENTICATED", message: "Sign in", retryable: false } });
  });

  it("accepts only same-origin or configured-origin writes", () => {
    expect(() => validateWriteOrigin(new Request("http://localhost:3000/api/v1/visits", { method: "POST", headers: { origin: "http://localhost:3000" } }))).not.toThrow();
    expect(() => validateWriteOrigin(new Request("http://internal:3000/api/v1/visits", { method: "POST", headers: { origin: "https://bitequest.example" } }), "https://bitequest.example")).not.toThrow();
    expect(() => validateWriteOrigin(new Request("http://localhost:3000/api/v1/visits", { method: "POST", headers: { origin: "https://evil.example" } }))).toThrowError(ApiProblem);
    expect(() => validateWriteOrigin(new Request("http://localhost:3000/api/v1/visits", { method: "POST" }))).toThrowError(ApiProblem);
  });

  it("redacts forbidden operational fields", () => {
    expect(sanitizeLog({ requestId: "r1", route: "/api/v1/visits", status: 201, cookie: "secret", receiptId: "raw", latitude: 37.7, providerOutcome: "fallback" })).toEqual({
      requestId: "r1",
      route: "/api/v1/visits",
      status: 201,
      providerOutcome: "fallback",
    });
  });
});

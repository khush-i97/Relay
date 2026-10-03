import { describe, expect, expectTypeOf, it } from "vitest";

import {
  API_ERROR_STATUS,
  type AdventureRequest,
  type AdventureStreamEvent,
  type CollectionResponse,
  type NearbyResponse,
  type RedemptionRequest,
  type RedemptionResponse,
  type SessionResponse,
  type Summary,
  type VisitRequest,
  type VisitResponse,
  type WalletResponse,
} from "../../shared/contracts";

describe("contract v1", () => {
  it("exposes direct response shapes and every endpoint payload", () => {
    expectTypeOf<SessionResponse>().toHaveProperty("summary");
    expectTypeOf<Summary>().toHaveProperty("balanceCents");
    expectTypeOf<NearbyResponse>().toHaveProperty("restaurants");
    expectTypeOf<CollectionResponse>().toHaveProperty("discoveries");
    expectTypeOf<WalletResponse>().toHaveProperty("transactions");
    expectTypeOf<VisitRequest>().toHaveProperty("demoPurchase");
    expectTypeOf<VisitResponse>().toHaveProperty("visitId");
    expectTypeOf<RedemptionRequest>().toHaveProperty("amountCents");
    expectTypeOf<RedemptionResponse>().toHaveProperty("settlementStatus");
    expectTypeOf<AdventureRequest>().toHaveProperty("maxSpendCents");
    expectTypeOf<AdventureStreamEvent>().toHaveProperty("type");
  });

  it("maps shared errors to their HTTP status", () => {
    expect(API_ERROR_STATUS.UNAUTHENTICATED).toBe(401);
    expect(API_ERROR_STATUS.IDEMPOTENCY_CONFLICT).toBe(409);
    expect(API_ERROR_STATUS.LOCATION_TOO_FAR).toBe(422);
    expect(API_ERROR_STATUS.RATE_LIMITED).toBe(429);
    expect(API_ERROR_STATUS.SERVICE_UNAVAILABLE).toBe(503);
  });
});

import { describe, expect, it } from "vitest";

import { ApiProblem } from "../../lib/server/errors";
import {
  adventureRequestSchema,
  nearbyQuerySchema,
  redemptionRequestSchema,
  validateVisitLocation,
  visitRequestSchema,
} from "../../lib/server/validation";

const validVisit = {
  restaurantId: "demo-mission-taco",
  location: {
    latitude: 37.7599,
    longitude: -122.4148,
    accuracyMeters: 12,
    capturedAt: "2026-10-03T20:00:00.000Z",
  },
  demoPurchase: { receiptId: "receipt-1", billCents: 500 },
};

describe("request validation", () => {
  it("bounds nearby queries", () => {
    expect(nearbyQuerySchema.safeParse({ latitude: "37.7", longitude: "-122.4", radiusMeters: "100" }).success).toBe(true);
    expect(nearbyQuerySchema.safeParse({ latitude: "37.7", longitude: "-122.4", radiusMeters: "99" }).success).toBe(false);
    expect(nearbyQuerySchema.safeParse({ latitude: "37.7", longitude: "-122.4", radiusMeters: "5001" }).success).toBe(false);
  });

  it("accepts only strict qualifying visit input", () => {
    expect(visitRequestSchema.safeParse(validVisit).success).toBe(true);
    expect(visitRequestSchema.safeParse({ ...validVisit, xpAwarded: 1200 }).success).toBe(false);
    expect(visitRequestSchema.safeParse({ ...validVisit, demoPurchase: { receiptId: "receipt-1", billCents: 499 } }).success).toBe(false);
    expect(visitRequestSchema.safeParse({ ...validVisit, location: { ...validVisit.location, accuracyMeters: 101 } }).success).toBe(false);
  });

  it("reports freshness, future, and distance failures with contract codes", () => {
    const restaurant = { latitude: 37.7599, longitude: -122.4148 };
    const now = new Date("2026-10-03T20:00:00.000Z");
    expect(() => validateVisitLocation(validVisit.location, restaurant, now)).not.toThrow();
    expectProblem({ ...validVisit.location, capturedAt: "2026-10-03T19:58:59.000Z" }, restaurant, now, "LOCATION_STALE");
    expectProblem({ ...validVisit.location, capturedAt: "2026-10-03T20:00:06.000Z" }, restaurant, now, "LOCATION_IN_FUTURE");
    expectProblem({ ...validVisit.location, latitude: 37.761 }, restaurant, now, "LOCATION_TOO_FAR");
  });

  it("validates redemption input shape", () => {
    const valid = { restaurantId: "demo-sunset-ramen", demoReceiptId: "redeem-1", billCents: 300, amountCents: 30 };
    expect(redemptionRequestSchema.safeParse(valid).success).toBe(true);
    expect(redemptionRequestSchema.safeParse({ ...valid, amountCents: 0 }).success).toBe(false);
    expect(redemptionRequestSchema.safeParse({ ...valid, amountCents: 501 }).success).toBe(false);
    expect(redemptionRequestSchema.safeParse({ ...valid, verified: true }).success).toBe(false);
  });

  it("applies bounded adventure defaults", () => {
    expect(adventureRequestSchema.parse({ location: { latitude: 37.77, longitude: -122.42 } })).toEqual({
      location: { latitude: 37.77, longitude: -122.42 },
      maxSpendCents: 3000,
      maxDurationMinutes: 90,
      maxStops: 2,
      preferences: [],
      onlyUndiscovered: true,
    });
    expect(adventureRequestSchema.safeParse({ location: { latitude: 37.77, longitude: -122.42 }, maxStops: 4 }).success).toBe(false);
  });
});

function expectProblem(
  location: typeof validVisit.location,
  restaurant: { latitude: number; longitude: number },
  now: Date,
  code: string,
) {
  try {
    validateVisitLocation(location, restaurant, now);
    throw new Error("expected validation error");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiProblem);
    expect((error as ApiProblem).code).toBe(code);
  }
}

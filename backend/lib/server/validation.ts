import { z } from "zod";

import type { LocationSample, Point } from "../../shared/contracts";
import { haversineMeters } from "./domain/geo";
import { ApiProblem } from "./errors";

const latitude = z.coerce.number().finite().min(-90).max(90);
const longitude = z.coerce.number().finite().min(-180).max(180);
const pointSchema = z.strictObject({ latitude, longitude });

export const nearbyQuerySchema = z.strictObject({
  latitude,
  longitude,
  radiusMeters: z.coerce.number().int().min(100).max(5000),
});

export const visitRequestSchema = z.strictObject({
  restaurantId: z.string().trim().min(1).max(128),
  location: z.strictObject({
    latitude,
    longitude,
    accuracyMeters: z.number().finite().min(0).max(100),
    capturedAt: z.iso.datetime({ offset: true }),
  }),
  demoPurchase: z.strictObject({
    receiptId: z.string().trim().min(1).max(128),
    billCents: z.number().int().min(500).max(10_000_000),
  }),
});

export const redemptionRequestSchema = z
  .strictObject({
    restaurantId: z.string().trim().min(1).max(128),
    demoReceiptId: z.string().trim().min(1).max(128),
    billCents: z.number().int().min(1).max(10_000_000),
    amountCents: z.number().int().min(1).max(500),
  })
  .refine(({ amountCents, billCents }) => amountCents <= billCents, {
    path: ["amountCents"],
    message: "amountCents cannot exceed billCents",
  });

export const adventureRequestSchema = z
  .strictObject({
    location: pointSchema,
    maxSpendCents: z.number().int().min(1).max(100_000).default(3000),
    maxDurationMinutes: z.number().int().min(20).max(480).default(90),
    maxStops: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    preferences: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
    onlyUndiscovered: z.boolean().default(true),
  });

export function validateVisitLocation(location: LocationSample, restaurant: Point, now = new Date()): void {
  const capturedAt = new Date(location.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) throw new ApiProblem("LOCATION_INVALID", "Location timestamp is invalid");
  if (location.accuracyMeters < 0 || location.accuracyMeters > 100) {
    throw new ApiProblem("LOCATION_INACCURATE", "Location accuracy must be within 100 meters");
  }
  const ageMs = now.getTime() - capturedAt.getTime();
  if (ageMs < -5_000) throw new ApiProblem("LOCATION_IN_FUTURE", "Location timestamp is too far in the future");
  if (ageMs > 60_000) throw new ApiProblem("LOCATION_STALE", "Location is more than 60 seconds old");
  if (haversineMeters(location, restaurant) > 100) {
    throw new ApiProblem("LOCATION_TOO_FAR", "Location is more than 100 meters from the restaurant");
  }
}

import { describe, expect, it } from "vitest";

import fixtures from "../../shared/fixtures.json";
import { SF_DEMO_CENTER } from "../../shared/contracts";

describe("synthetic restaurant fixtures", () => {
  it("contains a stable, valid SF demo catalog", () => {
    expect(fixtures).toHaveLength(80);
    expect(new Set(fixtures.map((restaurant) => restaurant.id)).size).toBe(80);
    expect(fixtures.map((restaurant) => restaurant.id)).toEqual(
      expect.arrayContaining(["demo-mission-taco", "demo-sunset-ramen", "demo-embarcadero-bites"]),
    );

    for (const restaurant of fixtures) {
      expect(restaurant.isSynthetic).toBe(true);
      expect(restaurant.rewardCents).toBe(50);
      expect([150, 400, 800, 1200]).toContain(restaurant.discoveryXp);
      expect(Math.abs(restaurant.latitude - SF_DEMO_CENTER.latitude)).toBeLessThan(0.08);
      expect(Math.abs(restaurant.longitude - SF_DEMO_CENTER.longitude)).toBeLessThan(0.08);
    }
  });
});

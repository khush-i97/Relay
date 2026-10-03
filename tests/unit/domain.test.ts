import { describe, expect, it } from "vitest";

import { canonicalHash } from "../../lib/server/domain/canonical-json";
import { haversineMeters } from "../../lib/server/domain/geo";
import { buildSummary } from "../../lib/server/domain/summary";
import { sfLocalDate } from "../../lib/server/domain/time";

describe("domain rules", () => {
  it.each([
    [0, 1, 0, 1000],
    [999, 1, 999, 1],
    [1000, 2, 0, 1000],
    [2450, 3, 450, 550],
  ])("derives progression from %i XP", (totalXp, level, xpIntoLevel, xpNeededForNextLevel) => {
    expect(buildSummary(totalXp, 50)).toEqual({
      totalXp,
      level,
      xpIntoLevel,
      xpNeededForNextLevel,
      balanceCents: 50,
      rewardFunding: "platform",
      verificationMode: "demo",
    });
  });

  it("distinguishes points just inside and outside 100 meters", () => {
    const origin = { latitude: 37.7749, longitude: -122.4194 };
    expect(haversineMeters(origin, { latitude: 37.77579, longitude: -122.4194 })).toBeLessThan(100);
    expect(haversineMeters(origin, { latitude: 37.77581, longitude: -122.4194 })).toBeGreaterThan(100);
  });

  it("uses the Los Angeles date across midnight and DST", () => {
    expect(sfLocalDate(new Date("2026-03-08T07:59:59Z"))).toBe("2026-03-07");
    expect(sfLocalDate(new Date("2026-03-08T08:00:00Z"))).toBe("2026-03-08");
    expect(sfLocalDate(new Date("2026-11-01T08:30:00Z"))).toBe("2026-11-01");
    expect(sfLocalDate(new Date("2026-11-02T07:59:59Z"))).toBe("2026-11-01");
    expect(sfLocalDate(new Date("2026-11-02T08:00:00Z"))).toBe("2026-11-02");
  });

  it("hashes canonical JSON independent of object key order", async () => {
    await expect(canonicalHash({ b: 2, a: { d: 4, c: 3 } })).resolves.toBe(
      await canonicalHash({ a: { c: 3, d: 4 }, b: 2 }),
    );
    await expect(canonicalHash({ a: 1 })).resolves.not.toBe(await canonicalHash({ a: 2 }));
  });
});

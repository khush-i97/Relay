import type { Summary } from "../../../shared/contracts";

export function buildSummary(totalXp: number, balanceCents: number): Summary {
  if (!Number.isInteger(totalXp) || totalXp < 0 || !Number.isInteger(balanceCents) || balanceCents < 0) {
    throw new RangeError("XP and balance must be nonnegative integers");
  }

  const xpIntoLevel = totalXp % 1000;
  return {
    totalXp,
    level: 1 + Math.floor(totalXp / 1000),
    xpIntoLevel,
    xpNeededForNextLevel: 1000 - xpIntoLevel,
    balanceCents,
    rewardFunding: "platform",
    verificationMode: "demo",
  };
}

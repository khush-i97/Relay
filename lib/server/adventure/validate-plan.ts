import type { PlanningCandidate, RankedCandidate } from "../providers/types";

export function validateProviderRanking(ranking: RankedCandidate[], candidates: PlanningCandidate[]): RankedCandidate[] {
  const allowed = new Set(candidates.map(({ id }) => id));
  const seen = new Set<string>();
  if (!Array.isArray(ranking) || ranking.length === 0) throw new Error("Provider returned no candidates");
  for (const item of ranking) {
    if (!item || typeof item.restaurantId !== "string" || !allowed.has(item.restaurantId)) throw new Error("Provider returned an unknown restaurant");
    if (seen.has(item.restaurantId)) throw new Error("Provider returned a repeated restaurant");
    if (typeof item.reason !== "string" || !item.reason.trim()) throw new Error("Provider returned an invalid reason");
    seen.add(item.restaurantId);
  }
  return ranking;
}

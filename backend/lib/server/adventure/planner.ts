import type { AdventurePlan, AdventureRequest, AdventureStop, Point } from "../../../shared/contracts";
import { haversineMeters } from "../domain/geo";
import { logEvent } from "../log";
import { deterministicProvider } from "../providers/deterministic";
import type { PlanningCandidate, PlanningProvider, RankedCandidate } from "../providers/types";
import { validateProviderRanking } from "./validate-plan";

interface PlanningContext {
  candidates: PlanningCandidate[];
  currentDailyCredits: number;
  provider: PlanningProvider;
  sources?: { title: string; url: string }[];
}

export async function planAdventure(input: Required<AdventureRequest>, context: PlanningContext, signal: AbortSignal): Promise<AdventurePlan> {
  if (signal.aborted) throw signal.reason ?? new Error("Planning aborted");
  const eligible = context.candidates
    .filter((candidate) => candidate.availability !== "closed")
    .filter((candidate) => !input.onlyUndiscovered || !candidate.discovered)
    .filter((candidate) => candidate.estimatedMealCents <= input.maxSpendCents)
    .slice(0, 10);

  if (eligible.length === 0) return emptyPlan("No restaurants match the requested budget and filters");

  let ranking: RankedCandidate[];
  let provider = context.provider.name;
  let mode: AdventurePlan["mode"] = provider === "deterministic" ? "fallback" : "live";
  let explanation = provider === "deterministic" ? "A deterministic route was created from the local catalog" : `Ranked by ${provider}`;
  try {
    ranking = validateProviderRanking(await context.provider.rank(eligible, input, signal), eligible);
  } catch (error) {
    if (signal.aborted) throw error;
    logEvent({ event: "adventure.provider_fallback", provider, error: error instanceof Error ? error.message : String(error) });
    ranking = await deterministicProvider.rank(eligible, input, signal);
    provider = "deterministic";
    mode = "fallback";
    explanation = "Live AI was unavailable, so a deterministic route was created";
  }

  const byId = new Map(eligible.map((candidate) => [candidate.id, candidate]));
  const selected: { candidate: PlanningCandidate; ranked: RankedCandidate; distance: number; walk: number }[] = [];
  let cursor: Point = input.location;
  let cost = 0;
  let minutes = 0;
  for (const ranked of ranking) {
    const candidate = byId.get(ranked.restaurantId)!;
    const distance = Math.round(haversineMeters(cursor, candidate));
    const walk = Math.ceil(distance / 75);
    if (cost + candidate.estimatedMealCents > input.maxSpendCents || minutes + walk + 20 > input.maxDurationMinutes) continue;
    selected.push({ candidate, ranked, distance, walk });
    cost += candidate.estimatedMealCents;
    minutes += walk + 20;
    cursor = candidate;
    if (selected.length === input.maxStops) break;
  }

  if (selected.length === 0) return emptyPlan("No restaurant fits within both the spending and duration limits");

  let remainingCredits = Math.max(0, 200 - context.currentDailyCredits);
  const stops: AdventureStop[] = selected.map(({ candidate, ranked, distance, walk }) => {
    const potentialCreditCents = candidate.rewardEligibleToday ? Math.min(candidate.rewardCents, remainingCredits) : 0;
    remainingCredits -= potentialCreditCents;
    return {
      restaurantId: candidate.id,
      reason: ranked.reason,
      estimatedMealCents: candidate.estimatedMealCents,
      potentialXp: candidate.discovered ? 0 : candidate.discoveryXp,
      potentialCreditCents,
      distanceMeters: distance,
      walkMinutes: walk,
    };
  });
  return {
    mode,
    provider,
    explanation,
    stops,
    route: [[input.location.longitude, input.location.latitude], ...selected.map(({ candidate }) => [candidate.longitude, candidate.latitude] as [number, number])],
    routeKind: "estimate",
    totals: {
      estimatedMealCents: stops.reduce((sum, stop) => sum + stop.estimatedMealCents, 0),
      totalMinutes: stops.reduce((sum, stop) => sum + stop.walkMinutes + 20, 0),
      potentialXp: stops.reduce((sum, stop) => sum + stop.potentialXp, 0),
      potentialCreditCents: stops.reduce((sum, stop) => sum + stop.potentialCreditCents, 0),
    },
    sources: context.sources ?? [],
  };
}

function emptyPlan(explanation: string): AdventurePlan {
  return {
    mode: "no_results",
    provider: "deterministic",
    explanation,
    stops: [],
    route: [],
    routeKind: "estimate",
    totals: { estimatedMealCents: 0, totalMinutes: 0, potentialXp: 0, potentialCreditCents: 0 },
    sources: [],
  };
}

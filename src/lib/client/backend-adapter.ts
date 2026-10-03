/**
 * Translates between the BiteQuest backend contract (`backend/shared/contracts.ts`) and the
 * shapes the UI consumes (`@/lib/contracts`), so live mode can stand in for the mock API.
 */
import type {
  AdventurePlan,
  AdventureRequest,
  CollectionResponse,
  LedgerEntry,
  LocationFix,
  NearbyResponse,
  NearbyRestaurant,
  Rarity,
  RedemptionRequest,
  Restaurant,
  StreamEvent,
  Summary,
  VisitRequest,
  WalletResponse,
} from "@/lib/contracts";
import { sfToday } from "@/lib/format";
import { haversine } from "@/lib/geo";
import { DAILY_CAP_CENTS, SF_CENTER, XP_PER_LEVEL } from "@/lib/rules";

export type BackendSummary = {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpNeededForNextLevel: number;
  balanceCents: number;
  rewardFunding: "platform";
  verificationMode: "demo";
};

export type BackendRestaurant = {
  id: string;
  name: string;
  cuisine: string;
  latitude: number;
  longitude: number;
  rarity: Rarity;
  discoveryXp: number;
  rewardCents: number;
  estimatedMealCents: number;
  availability: "open" | "closed" | null;
};

export type BackendNearbyRestaurant = BackendRestaurant & {
  distanceMeters: number;
  discovered: boolean;
  rewardEligibleToday: boolean;
};

export type BackendSessionResponse = { sessionId: string; summary: BackendSummary };
export type BackendNearbyResponse = {
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  restaurants: BackendNearbyRestaurant[];
};
export type BackendCollectionResponse = {
  count: number;
  discoveries: { restaurant: BackendRestaurant; discoveredAt: string; firstVisitId: string }[];
};
export type BackendWalletResponse = {
  summary: BackendSummary;
  transactions: {
    id: string;
    restaurantId: string;
    restaurantName: string;
    kind: "earn" | "redeem";
    deltaCents: number;
    createdAt: string;
  }[];
};
export type BackendVisitResponse = {
  visitId: string;
  restaurantId: string;
  firstDiscovery: boolean;
  xpAwarded: number;
  creditAwardedCents: number;
  summary: BackendSummary;
};
export type BackendRedemptionResponse = {
  redemptionId: string;
  restaurantId: string;
  amountCents: number;
  settlementStatus: "simulated";
  summary: BackendSummary;
};
export type BackendAdventurePlan = {
  mode: "live" | "fallback" | "no_results";
  provider: string;
  explanation: string;
  ranking?: { source: "moss" | "catalog"; reason: string; topRestaurantIds: string[] };
  stops: {
    restaurantId: string;
    reason: string;
    estimatedMealCents: number;
    potentialXp: number;
    potentialCreditCents: number;
    distanceMeters: number;
    walkMinutes: number;
  }[];
  route: [number, number][];
};
export type BackendStreamEvent =
  | { type: "progress"; stage: string; message: string }
  | { type: "complete"; plan: BackendAdventurePlan }
  | { type: "error"; error: { code: string; message: string; retryable: boolean } };

/** Backend error codes whose UI copy lives under a different code. */
const ERROR_CODE_ALIASES: Record<string, string> = { RESTAURANT_NOT_FOUND: "NOT_FOUND" };

export function toUiErrorCode(code: string): string {
  return ERROR_CODE_ALIASES[code] ?? code;
}

export function toRestaurant(row: BackendRestaurant): Restaurant {
  return {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    rarity: row.rarity,
    firstDiscoveryXp: row.discoveryXp,
    rewardCents: row.rewardCents,
    estimatedMealCents: row.estimatedMealCents,
    coordinates: { latitude: row.latitude, longitude: row.longitude },
    imageUrl: null,
    synthetic: true,
    availability: row.availability,
  };
}

function ineligibleCode(restaurantId: string, ledger: LedgerEntry[]): string {
  const today = sfToday();
  const earnedHereToday = ledger.some(
    (entry) => entry.kind === "earn" && entry.restaurantId === restaurantId && sfToday(new Date(entry.createdAt)) === today,
  );
  return earnedHereToday ? "ALREADY_EARNED_TODAY" : "DAILY_REWARD_CAP";
}

export function toNearbyResponse(body: BackendNearbyResponse, ledger: LedgerEntry[]): NearbyResponse {
  return {
    center: body.center,
    radiusMeters: body.radiusMeters,
    restaurants: body.restaurants.map((row) => ({
      ...toRestaurant(row),
      distanceMeters: row.distanceMeters,
      collected: row.discovered,
      rewardEligible: row.rewardEligibleToday,
      ineligibleCode: row.rewardEligibleToday ? null : ineligibleCode(row.id, ledger),
    })),
  };
}

export function toCollectionResponse(body: BackendCollectionResponse): CollectionResponse {
  const restaurants = body.discoveries
    .map(({ restaurant, discoveredAt }) => {
      const base = toRestaurant(restaurant);
      const entry: NearbyRestaurant = {
        ...base,
        distanceMeters: Math.round(haversine(SF_CENTER, base.coordinates)),
        collected: true,
        rewardEligible: true,
        ineligibleCode: null,
      };
      return { ...entry, discoveredAt, xpAwarded: restaurant.discoveryXp };
    })
    .sort((a, b) => (a.discoveredAt < b.discoveredAt ? 1 : -1));
  return { count: body.count, restaurants };
}

export function toLedger(body: BackendWalletResponse): LedgerEntry[] {
  return body.transactions
    .map((tx) => ({
      id: tx.id,
      restaurantId: tx.restaurantId,
      restaurantName: tx.restaurantName,
      createdAt: tx.createdAt,
      amountCents: tx.deltaCents,
      kind: tx.kind,
      label: tx.kind === "earn" ? ("Platform-funded reward" as const) : ("Demo redemption" as const),
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function earnedToday(ledger: LedgerEntry[]): number {
  const today = sfToday();
  return ledger
    .filter((entry) => entry.kind === "earn" && sfToday(new Date(entry.createdAt)) === today)
    .reduce((sum, entry) => sum + entry.amountCents, 0);
}

export function toWalletResponse(body: BackendWalletResponse): WalletResponse {
  const entries = toLedger(body);
  return {
    balanceCents: body.summary.balanceCents,
    rewardFunding: "platform",
    earnedTodayCents: earnedToday(entries),
    dailyCapCents: DAILY_CAP_CENTS,
    entries,
  };
}

export function toSummary(
  summary: BackendSummary,
  extra: { sessionId: string; collectedCount: number; earnedTodayCents: number },
): Summary {
  return {
    sessionId: extra.sessionId,
    totalXp: summary.totalXp,
    level: summary.level,
    xpIntoLevel: summary.xpIntoLevel,
    xpPerLevel: XP_PER_LEVEL,
    balanceCents: summary.balanceCents,
    collectedCount: extra.collectedCount,
    earnedTodayCents: extra.earnedTodayCents,
    dailyCapCents: DAILY_CAP_CENTS,
    rewardFunding: "platform",
    verificationMode: "demo",
  };
}

function toBackendLocation(location: LocationFix) {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracyMeters: location.accuracyMeters,
    capturedAt: location.capturedAt,
  };
}

export function toBackendVisit(body: VisitRequest) {
  return {
    restaurantId: body.restaurantId,
    location: toBackendLocation(body.location),
    demoPurchase: { receiptId: body.receiptId, billCents: body.billAmountCents },
  };
}

export function toBackendRedemption(body: RedemptionRequest) {
  return {
    restaurantId: body.restaurantId,
    demoReceiptId: body.demoReceiptId,
    billCents: body.billAmountCents,
    amountCents: body.rewardAmountCents,
  };
}

export function toBackendAdventure(body: AdventureRequest) {
  return {
    // The origin may be a full location fix; the backend accepts only the point.
    location: { latitude: body.origin.latitude, longitude: body.origin.longitude },
    maxSpendCents: Math.min(100_000, Math.max(1, body.maxSpendCents)),
    maxDurationMinutes: Math.min(480, body.maxDurationMinutes),
    maxStops: body.maxStops,
    preferences: body.preferences
      .split(/[,;\n]+/)
      .map((word) => word.trim().slice(0, 50))
      .filter(Boolean)
      .slice(0, 10),
    onlyUndiscovered: body.onlyUndiscovered,
  };
}

/** Converts a backend plan, resolving each stop's display fields from the restaurant catalog. */
export function toStreamEvent(event: BackendStreamEvent, catalog: Map<string, Restaurant>): StreamEvent {
  if (event.type !== "complete") {
    return event.type === "error" ? { ...event, error: { ...event.error, code: toUiErrorCode(event.error.code) } } : event;
  }
  const plan = event.plan;
  if (plan.mode === "no_results" || plan.stops.length === 0) {
    return { type: "error", error: { code: "NO_MATCH", message: plan.explanation, retryable: true } };
  }
  const stops = plan.stops.flatMap((stop, index) => {
    const restaurant = catalog.get(stop.restaurantId);
    if (!restaurant) return [];
    return [
      {
        order: index + 1,
        restaurantId: stop.restaurantId,
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        rarity: restaurant.rarity,
        reason: stop.reason,
        estimatedMealCents: stop.estimatedMealCents,
        xp: stop.potentialXp,
        potentialRewardCents: stop.potentialCreditCents,
        coordinates: restaurant.coordinates,
      },
    ];
  });
  const result: AdventurePlan = {
    id: `adv_${Date.now()}`,
    routeKind: "estimate",
    totalEstimatedMealCents: stops.reduce((sum, stop) => sum + stop.estimatedMealCents, 0),
    totalXp: stops.reduce((sum, stop) => sum + stop.xp, 0),
    totalPotentialRewardCents: stops.reduce((sum, stop) => sum + stop.potentialRewardCents, 0),
    totalWalkMinutes: Math.max(1, plan.stops.reduce((sum, stop) => sum + stop.walkMinutes, 0)),
    stops,
    route: plan.route,
    engine: {
      planner: plan.provider,
      mode: plan.mode === "live" ? "live" : "fallback",
      explanation: plan.explanation,
      ranking: plan.ranking?.reason ?? "Catalog order",
      rankingSource: plan.ranking?.source ?? "catalog",
    },
  };
  return { type: "complete", plan: result };
}

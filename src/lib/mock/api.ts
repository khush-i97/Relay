import { fail, type ApiError } from "@/lib/api-error";
import type {
  AdventurePlan,
  AdventureRequest,
  AdventureStop,
  CollectionResponse,
  Coordinates,
  LedgerEntry,
  NearbyQuery,
  NearbyResponse,
  RedemptionRequest,
  RedemptionResponse,
  SessionResponse,
  StreamEvent,
  Summary,
  VisitRequest,
  VisitResponse,
  WalletResponse,
} from "@/lib/contracts";
import { FIXTURES, restaurantById } from "@/lib/fixtures";
import { sfToday } from "@/lib/format";
import { haversine } from "@/lib/geo";
import {
  DAILY_CAP_CENTS,
  LOCATION_MAX_ACCURACY_M,
  LOCATION_MAX_AGE_MS,
  LOCATION_MAX_DISTANCE_M,
  MAX_REDEEM_CENTS,
  MIN_BILL_CENTS,
  REDEEM_SUCCESS_MESSAGE,
  VISIT_REWARD_CENTS,
  XP_PER_LEVEL,
} from "@/lib/rules";
import type { RelayApi } from "@/lib/client/types";

const STORAGE_KEY = "relay.demo.v1";

type Collected = { discoveredAt: string; xpAwarded: number };
type Earn = { restaurantId: string; sfDate: string; visitId: string; amountCents: number };
type StoredVisit = Omit<VisitResponse, "summary" | "replayed">;
type StoredRedeem = Omit<RedemptionResponse, "summary" | "replayed" | "balanceCents">;

type IdempotencyRecord =
  | { hash: string; kind: "visit"; visit: StoredVisit }
  | { hash: string; kind: "redeem"; redeem: StoredRedeem };

type State = {
  version: 1;
  sessionId: string;
  totalXp: number;
  balanceCents: number;
  collected: Record<string, Collected>;
  earns: Earn[];
  ledger: LedgerEntry[];
  idempotency: Record<string, IdempotencyRecord>;
};

function uid(prefix: string): string {
  const cryptoObj = globalThis.crypto;
  const rand = cryptoObj?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rand}`;
}

function seed(): State {
  return {
    version: 1,
    sessionId: uid("sess"),
    totalXp: 0,
    balanceCents: 0,
    collected: {},
    earns: [],
    ledger: [],
    idempotency: {},
  };
}

let state: State = load();

function load(): State {
  if (typeof localStorage === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as State;
    if (parsed?.version !== 1 || !parsed.sessionId) return seed();
    return {
      ...seed(),
      ...parsed,
      collected: parsed.collected ?? {},
      earns: parsed.earns ?? [],
      ledger: parsed.ledger ?? [],
      idempotency: parsed.idempotency ?? {},
    };
  } catch {
    return seed();
  }
}

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* demo storage can fail quietly; the in-memory session still works */
  }
}

function buildSummary(current: State): Summary {
  const today = sfToday();
  const earnedTodayCents = current.earns
    .filter((earn) => earn.sfDate === today)
    .reduce((sum, earn) => sum + earn.amountCents, 0);
  return {
    sessionId: current.sessionId,
    totalXp: current.totalXp,
    level: 1 + Math.floor(current.totalXp / XP_PER_LEVEL),
    xpIntoLevel: current.totalXp % XP_PER_LEVEL,
    xpPerLevel: XP_PER_LEVEL,
    balanceCents: current.balanceCents,
    collectedCount: Object.keys(current.collected).length,
    earnedTodayCents,
    dailyCapCents: DAILY_CAP_CENTS,
    rewardFunding: "platform",
    verificationMode: "demo",
  };
}

function sessionFrom(current: State): SessionResponse {
  return {
    sessionId: current.sessionId,
    verificationMode: "demo",
    rewardFunding: "platform",
  };
}

function eligibility(current: State, restaurantId: string) {
  const today = sfToday();
  const todays = current.earns.filter((earn) => earn.sfDate === today);
  const earned = todays.reduce((sum, earn) => sum + earn.amountCents, 0);
  if (todays.some((earn) => earn.restaurantId === restaurantId)) {
    return { rewardEligible: false, ineligibleCode: "ALREADY_EARNED_TODAY" };
  }
  if (earned + VISIT_REWARD_CENTS > DAILY_CAP_CENTS) {
    return { rewardEligible: false, ineligibleCode: "DAILY_REWARD_CAP" };
  }
  return { rewardEligible: true, ineligibleCode: null };
}

function projectNearby(center: Coordinates, radiusMeters: number): NearbyResponse {
  const restaurants = FIXTURES.map((restaurant) => {
    const distanceMeters = haversine(center, restaurant.coordinates);
    const gate = eligibility(state, restaurant.id);
    return {
      ...restaurant,
      distanceMeters: Math.round(distanceMeters),
      collected: Boolean(state.collected[restaurant.id]),
      rewardEligible: gate.rewardEligible,
      ineligibleCode: gate.ineligibleCode,
    };
  })
    .filter((restaurant) => restaurant.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return { center, radiusMeters, restaurants };
}

function assertLocation(request: VisitRequest) {
  const restaurant = restaurantById(request.restaurantId);
  if (!restaurant) fail("NOT_FOUND", 404);
  const captured = Date.parse(request.location.capturedAt);
  if (!Number.isFinite(captured)) fail("LOCATION_STALE", 422);
  const age = Date.now() - captured;
  if (age > LOCATION_MAX_AGE_MS || age < -5_000) fail("LOCATION_STALE", 422);
  if (
    !Number.isFinite(request.location.accuracyMeters) ||
    request.location.accuracyMeters < 0 ||
    request.location.accuracyMeters > LOCATION_MAX_ACCURACY_M
  ) {
    fail("LOCATION_INACCURATE", 422);
  }
  const distance = haversine(request.location, restaurant.coordinates);
  if (distance > LOCATION_MAX_DISTANCE_M) fail("LOCATION_TOO_FAR", 422);
  return restaurant;
}

function hashBody(body: unknown): string {
  return JSON.stringify(body);
}

function replayVisit(record: IdempotencyRecord): VisitResponse {
  if (record.kind !== "visit") fail("IDEMPOTENCY_CONFLICT", 409);
  return { ...record.visit, summary: buildSummary(state), replayed: true };
}

function createVisit(body: VisitRequest, idempotencyKey: string): VisitResponse {
  if (!idempotencyKey) fail("IDEMPOTENCY_CONFLICT", 409, "Start a new confirmation for the changed request");
  const hash = hashBody(body);
  const existing = state.idempotency[idempotencyKey];
  if (existing) {
    if (existing.hash !== hash) fail("IDEMPOTENCY_CONFLICT", 409);
    return replayVisit(existing);
  }
  if (!Number.isInteger(body.billAmountCents)) fail("PURCHASE_TOO_SMALL", 422);
  if (body.billAmountCents < MIN_BILL_CENTS) fail("PURCHASE_TOO_SMALL", 422);
  const restaurant = assertLocation(body);
  const gate = eligibility(state, restaurant.id);
  if (!gate.rewardEligible && gate.ineligibleCode) fail(gate.ineligibleCode, 409);

  const first = !state.collected[restaurant.id];
  const xpAwarded = first ? restaurant.firstDiscoveryXp : 0;
  const levelBefore = 1 + Math.floor(state.totalXp / XP_PER_LEVEL);
  const totalXp = state.totalXp + xpAwarded;
  const levelAfter = 1 + Math.floor(totalXp / XP_PER_LEVEL);
  const visitId = uid("vis");
  const createdAt = new Date().toISOString();

  state.totalXp = totalXp;
  state.balanceCents += VISIT_REWARD_CENTS;
  if (first) {
    state.collected[restaurant.id] = { discoveredAt: createdAt, xpAwarded };
  }
  state.earns.push({
    restaurantId: restaurant.id,
    sfDate: sfToday(),
    visitId,
    amountCents: VISIT_REWARD_CENTS,
  });
  state.ledger.push({
    id: uid("led"),
    visitId,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    createdAt,
    amountCents: VISIT_REWARD_CENTS,
    kind: "earn",
    label: "Platform-funded reward",
  });

  const visit: StoredVisit = {
    visitId,
    restaurantId: restaurant.id,
    receiptId: body.receiptId,
    xpAwarded,
    creditAwardedCents: VISIT_REWARD_CENTS,
    firstDiscovery: first,
    leveledUp: levelAfter > levelBefore,
    levelAfter,
  };
  state.idempotency[idempotencyKey] = { hash, kind: "visit", visit };
  persist();
  return { ...visit, summary: buildSummary(state), replayed: false };
}

function createRedemption(body: RedemptionRequest, idempotencyKey: string): RedemptionResponse {
  if (!idempotencyKey) fail("IDEMPOTENCY_CONFLICT", 409);
  const hash = hashBody(body);
  const existing = state.idempotency[idempotencyKey];
  if (existing) {
    if (existing.hash !== hash || existing.kind !== "redeem") fail("IDEMPOTENCY_CONFLICT", 409);
    return {
      ...existing.redeem,
      balanceCents: state.balanceCents,
      summary: buildSummary(state),
      replayed: true,
    };
  }

  const restaurant = restaurantById(body.restaurantId);
  if (!restaurant) fail("NOT_FOUND", 404);
  const reward = body.rewardAmountCents;
  const bill = body.billAmountCents;
  if (!Number.isInteger(reward) || !Number.isInteger(bill)) {
    fail("REWARD_LIMIT", 422, "Enter dollar amounts with at most two decimal places.");
  }
  if (bill < 1) fail("REWARD_LIMIT", 422, "Enter the total bill before applying a reward.");
  if (reward < 1) fail("REWARD_TOO_SMALL", 422);
  if (reward > bill || reward > MAX_REDEEM_CENTS) fail("REWARD_LIMIT", 422);
  if (reward > state.balanceCents) fail("INSUFFICIENT_BALANCE", 409);
  const earnedElsewhere = state.earns.some((earn) => earn.restaurantId !== restaurant.id);
  if (!earnedElsewhere) fail("PORTABILITY_REQUIRED", 409);

  state.balanceCents -= reward;
  const redemptionId = uid("rdm");
  const createdAt = new Date().toISOString();
  state.ledger.push({
    id: uid("led"),
    redemptionId,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    createdAt,
    amountCents: -reward,
    kind: "redeem",
    label: "Demo redemption",
  });
  const redeem: StoredRedeem = {
    redemptionId,
    restaurantId: restaurant.id,
    settlementStatus: "simulated",
    rewardAmountCents: reward,
    message: REDEEM_SUCCESS_MESSAGE,
  };
  state.idempotency[idempotencyKey] = { hash, kind: "redeem", redeem };
  persist();
  return {
    ...redeem,
    balanceCents: state.balanceCents,
    summary: buildSummary(state),
    replayed: false,
  };
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function planError(code: string, message: string): StreamEvent {
  return { type: "error", error: { code, message, retryable: true } };
}

function buildPlan(request: AdventureRequest): AdventurePlan | StreamEvent {
  if (!Number.isInteger(request.maxStops) || request.maxStops < 1 || request.maxStops > 3) {
    return planError("INVALID_STOPS", "Choose 1, 2, or 3 stops.");
  }
  if (!Number.isInteger(request.maxSpendCents) || request.maxSpendCents < 0) {
    return planError("INVALID_BUDGET", "Enter a budget in dollars.");
  }
  if (!Number.isInteger(request.maxDurationMinutes) || request.maxDurationMinutes < 20) {
    return planError("INVALID_DURATION", "Allow at least 20 minutes.");
  }

  let pool = FIXTURES.filter((restaurant) => haversine(request.origin, restaurant.coordinates) <= 4500);
  if (request.onlyUndiscovered) {
    pool = pool.filter((restaurant) => !state.collected[restaurant.id]);
  }
  const words = request.preferences
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  if (words.length > 0) {
    pool = pool.filter((restaurant) => {
      const hay = `${restaurant.name} ${restaurant.cuisine} ${restaurant.rarity}`.toLowerCase();
      return words.some((word) => hay.includes(word));
    });
    if (pool.length === 0) {
      return planError("NO_MATCH", "No demo venues match those preferences.");
    }
  }
  if (pool.length === 0) {
    return planError(
      "NONE_LEFT",
      "You've already discovered every venue in this demo. Turn off undiscovered-only to plan a return route.",
    );
  }

  const chosen: AdventureStop[] = [];
  const route: [number, number][] = [[request.origin.longitude, request.origin.latitude]];
  let cursor: Coordinates = request.origin;
  let spend = 0;
  let minutes = 0;
  const remaining = [...pool];

  while (chosen.length < request.maxStops && remaining.length > 0) {
    remaining.sort(
      (a, b) => haversine(cursor, a.coordinates) - haversine(cursor, b.coordinates),
    );
    let picked = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const restaurant = remaining[index];
      if (!restaurant) continue;
      if (spend + restaurant.estimatedMealCents > request.maxSpendCents) continue;
      const leg = haversine(cursor, restaurant.coordinates) / 75;
      if (minutes + leg + 40 > request.maxDurationMinutes) continue;
      picked = index;
      break;
    }
    if (picked < 0) break;
    const restaurant = remaining.splice(picked, 1)[0];
    if (!restaurant) break;
    const leg = haversine(cursor, restaurant.coordinates) / 75;
    minutes += leg + 40;
    spend += restaurant.estimatedMealCents;
    const collected = Boolean(state.collected[restaurant.id]);
    chosen.push({
      order: chosen.length + 1,
      restaurantId: restaurant.id,
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      rarity: restaurant.rarity,
      reason: reasonFor(restaurant.cuisine, restaurant.rarity, restaurant.firstDiscoveryXp, chosen.length, collected),
      estimatedMealCents: restaurant.estimatedMealCents,
      xp: collected ? 0 : restaurant.firstDiscoveryXp,
      potentialRewardCents: VISIT_REWARD_CENTS,
      coordinates: restaurant.coordinates,
    });
    route.push([restaurant.coordinates.longitude, restaurant.coordinates.latitude]);
    cursor = restaurant.coordinates;
  }

  if (chosen.length === 0) {
    const cheapest = Math.min(...pool.map((restaurant) => restaurant.estimatedMealCents));
    if (request.maxSpendCents < cheapest) {
      return planError("BUDGET_SHORT", "No stops fit that budget. Try raising it above the least expensive meal.");
    }
    return planError("TIME_SHORT", "Those stops don't fit the time limit. Add minutes or fewer stops.");
  }

  return {
    id: uid("adv"),
    routeKind: "estimate",
    totalEstimatedMealCents: chosen.reduce((sum, stop) => sum + stop.estimatedMealCents, 0),
    totalXp: chosen.reduce((sum, stop) => sum + stop.xp, 0),
    totalPotentialRewardCents: chosen.reduce((sum, stop) => sum + stop.potentialRewardCents, 0),
    totalWalkMinutes: Math.max(1, Math.round(minutes)),
    stops: chosen,
    route,
  };
}

function reasonFor(
  cuisine: string,
  rarity: string,
  xp: number,
  index: number,
  collected: boolean,
): string {
  const food = cuisine.toLowerCase();
  if (!collected && index === 0) return `Start here. First discovery of this ${food} spot is worth ${xp} XP.`;
  if (!collected) return `Still undiscovered. ${rarity} ${food} on the way.`;
  return `Already collected. A return visit can still earn the credit, not more XP.`;
}

async function streamAdventure(
  body: AdventureRequest,
  signal: AbortSignal,
  onEvent: (event: StreamEvent) => void,
) {
  const steps: StreamEvent[] = [
    { type: "progress", stage: "catalog", message: "Checking restaurants you can reach" },
    { type: "progress", stage: "budget", message: "Fitting meals inside your budget" },
    { type: "progress", stage: "route", message: "Sketching a short walk" },
  ];
  for (const step of steps) {
    await wait(380, signal);
    onEvent(step);
  }
  const plan = buildPlan(body);
  if ("type" in plan) {
    onEvent(plan);
    return;
  }
  onEvent({ type: "complete", plan });
}

export const mockApi: RelayApi = {
  async ensureSession() {
    return sessionFrom(state);
  },
  async getSummary() {
    return buildSummary(state);
  },
  async getNearby(query: NearbyQuery) {
    return projectNearby(
      { latitude: query.latitude, longitude: query.longitude },
      query.radiusMeters,
    );
  },
  async getCollection(): Promise<CollectionResponse> {
    const nearby = projectNearby(
      { latitude: 37.791, longitude: -122.4055 },
      20_000,
    );
    const restaurants = nearby.restaurants
      .filter((restaurant) => state.collected[restaurant.id])
      .map((restaurant) => {
        const saved = state.collected[restaurant.id];
        return {
          ...restaurant,
          discoveredAt: saved?.discoveredAt ?? new Date().toISOString(),
          xpAwarded: saved?.xpAwarded ?? 0,
        };
      })
      .sort((a, b) => (a.discoveredAt < b.discoveredAt ? 1 : -1));
    return { count: restaurants.length, restaurants };
  },
  async getWallet(): Promise<WalletResponse> {
    const summary = buildSummary(state);
    return {
      balanceCents: state.balanceCents,
      rewardFunding: "platform",
      earnedTodayCents: summary.earnedTodayCents,
      dailyCapCents: DAILY_CAP_CENTS,
      entries: [...state.ledger].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    };
  },
  async createVisit(body, idempotencyKey) {
    return createVisit(body, idempotencyKey);
  },
  async createRedemption(body, idempotencyKey) {
    return createRedemption(body, idempotencyKey);
  },
  streamAdventure,
  async resetDemo() {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
    state = seed();
    persist();
    return sessionFrom(state);
  },
};

export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && error.name === "ApiError";
}

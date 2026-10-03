export const SF_DEMO_CENTER = { latitude: 37.7749, longitude: -122.4194 } as const;

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Availability = "open" | "closed" | null;
export type RewardFunding = "platform";
export type VerificationMode = "demo";

export interface Point {
  latitude: number;
  longitude: number;
}

export interface LocationSample extends Point {
  accuracyMeters: number;
  capturedAt: string;
}

export interface Summary {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpNeededForNextLevel: number;
  balanceCents: number;
  rewardFunding: RewardFunding;
  verificationMode: VerificationMode;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  latitude: number;
  longitude: number;
  rarity: Rarity;
  discoveryXp: number;
  rewardCents: number;
  estimatedMealCents: number;
  tags: string[];
  description: string;
  imageUrl: string | null;
  availability: Availability;
  isSynthetic: boolean;
}

export interface NearbyRestaurant extends Restaurant {
  distanceMeters: number;
  discovered: boolean;
  rewardEligibleToday: boolean;
}

export interface SessionResponse {
  sessionId: string;
  summary: Summary;
}

export interface NearbyResponse {
  center: Point;
  radiusMeters: number;
  restaurants: NearbyRestaurant[];
}

export interface Discovery {
  restaurant: Restaurant;
  discoveredAt: string;
  firstVisitId: string;
}

export interface CollectionResponse {
  discoveries: Discovery[];
  count: number;
}

export type WalletTransactionKind = "earn" | "redeem";

export interface WalletTransaction {
  id: string;
  restaurantId: string;
  restaurantName: string;
  kind: WalletTransactionKind;
  deltaCents: number;
  createdAt: string;
}

export interface WalletResponse {
  summary: Summary;
  transactions: WalletTransaction[];
}

export interface DemoPurchase {
  receiptId: string;
  billCents: number;
}

export interface VisitRequest {
  restaurantId: string;
  location: LocationSample;
  demoPurchase: DemoPurchase;
}

export interface VisitResponse {
  visitId: string;
  restaurantId: string;
  firstDiscovery: boolean;
  xpAwarded: number;
  creditAwardedCents: number;
  summary: Summary;
  verification: "demo";
}

export interface RedemptionRequest {
  restaurantId: string;
  demoReceiptId: string;
  billCents: number;
  amountCents: number;
}

export interface RedemptionResponse {
  redemptionId: string;
  restaurantId: string;
  amountCents: number;
  settlementStatus: "simulated";
  summary: Summary;
}

export interface AdventureRequest {
  location: Point;
  maxSpendCents?: number;
  maxDurationMinutes?: number;
  maxStops?: 1 | 2 | 3;
  preferences?: string[];
  onlyUndiscovered?: boolean;
}

export interface AdventureStop {
  restaurantId: string;
  reason: string;
  estimatedMealCents: number;
  potentialXp: number;
  potentialCreditCents: number;
  distanceMeters: number;
  walkMinutes: number;
}

export interface AdventureTotals {
  estimatedMealCents: number;
  totalMinutes: number;
  potentialXp: number;
  potentialCreditCents: number;
}

export interface AdventurePlan {
  mode: "live" | "fallback" | "no_results";
  provider: "zoowork" | "novita" | "deterministic";
  explanation: string;
  stops: AdventureStop[];
  route: [number, number][];
  routeKind: "estimate";
  totals: AdventureTotals;
  sources: { title: string; url: string }[];
  /** How candidates were ordered before planning; optional and additive. */
  ranking?: {
    source: "moss" | "catalog";
    reason: string;
    topRestaurantIds: string[];
  };
}

export type AdventureProgressStage = "catalog_loaded" | "candidates_ranked" | "plan_validated";

export type AdventureStreamEvent =
  | { type: "progress"; stage: AdventureProgressStage; message: string }
  | { type: "complete"; plan: AdventurePlan }
  | { type: "error"; error: ApiError };

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "ORIGIN_FORBIDDEN"
  | "DEMO_MODE_DISABLED"
  | "RESTAURANT_NOT_FOUND"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "RECEIPT_ALREADY_USED"
  | "ALREADY_EARNED_TODAY"
  | "DAILY_REWARD_CAP"
  | "INSUFFICIENT_BALANCE"
  | "PORTABILITY_REQUIRED"
  | "LOCATION_INVALID"
  | "LOCATION_TOO_FAR"
  | "LOCATION_STALE"
  | "LOCATION_INACCURATE"
  | "LOCATION_IN_FUTURE"
  | "PURCHASE_TOO_SMALL"
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface ErrorResponse {
  error: ApiError;
}

export const API_ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  ORIGIN_FORBIDDEN: 403,
  DEMO_MODE_DISABLED: 403,
  RESTAURANT_NOT_FOUND: 404,
  IDEMPOTENCY_KEY_REQUIRED: 422,
  IDEMPOTENCY_CONFLICT: 409,
  RECEIPT_ALREADY_USED: 409,
  ALREADY_EARNED_TODAY: 409,
  DAILY_REWARD_CAP: 409,
  INSUFFICIENT_BALANCE: 409,
  PORTABILITY_REQUIRED: 409,
  LOCATION_INVALID: 422,
  LOCATION_TOO_FAR: 422,
  LOCATION_STALE: 422,
  LOCATION_INACCURATE: 422,
  LOCATION_IN_FUTURE: 422,
  PURCHASE_TOO_SMALL: 422,
  INVALID_REQUEST: 422,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
};

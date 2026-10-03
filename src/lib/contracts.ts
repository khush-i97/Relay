import type { RARITY_XP } from "@/lib/rules";

export type Rarity = keyof typeof RARITY_XP;

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationFix = Coordinates & {
  accuracyMeters: number;
  capturedAt: string;
  simulated: boolean;
};

export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  rarity: Rarity;
  firstDiscoveryXp: number;
  rewardCents: number;
  estimatedMealCents: number;
  coordinates: Coordinates;
  imageUrl: null;
  synthetic: true;
  availability: string | null;
};

export type NearbyRestaurant = Restaurant & {
  distanceMeters: number;
  collected: boolean;
  rewardEligible: boolean;
  ineligibleCode: string | null;
};

export type Summary = {
  sessionId: string;
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  balanceCents: number;
  collectedCount: number;
  earnedTodayCents: number;
  dailyCapCents: number;
  rewardFunding: "platform";
  verificationMode: "demo";
};

export type SessionResponse = {
  sessionId: string;
  verificationMode: "demo";
  rewardFunding: "platform";
};

export type NearbyResponse = {
  center: Coordinates;
  radiusMeters: number;
  restaurants: NearbyRestaurant[];
};

export type CollectionEntry = NearbyRestaurant & {
  discoveredAt: string;
  xpAwarded: number;
};

export type CollectionResponse = {
  count: number;
  restaurants: CollectionEntry[];
};

export type LedgerEntry = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  createdAt: string;
  amountCents: number;
  kind: "earn" | "redeem";
  label: "Platform-funded reward" | "Demo redemption";
  visitId?: string;
  redemptionId?: string;
};

export type WalletResponse = {
  balanceCents: number;
  rewardFunding: "platform";
  earnedTodayCents: number;
  dailyCapCents: number;
  entries: LedgerEntry[];
};

export type VisitRequest = {
  restaurantId: string;
  receiptId: string;
  billAmountCents: number;
  location: LocationFix;
};

export type VisitResponse = {
  visitId: string;
  restaurantId: string;
  receiptId: string;
  xpAwarded: number;
  creditAwardedCents: number;
  firstDiscovery: boolean;
  leveledUp: boolean;
  levelAfter: number;
  summary: Summary;
  replayed: boolean;
};

export type RedemptionRequest = {
  restaurantId: string;
  demoReceiptId: string;
  billAmountCents: number;
  rewardAmountCents: number;
};

export type RedemptionResponse = {
  redemptionId: string;
  restaurantId: string;
  settlementStatus: "simulated";
  rewardAmountCents: number;
  balanceCents: number;
  message: string;
  summary: Summary;
  replayed: boolean;
};

export type AdventureRequest = {
  maxSpendCents: number;
  maxDurationMinutes: number;
  maxStops: number;
  preferences: string;
  onlyUndiscovered: boolean;
  origin: Coordinates;
};

export type AdventureStop = {
  order: number;
  restaurantId: string;
  name: string;
  cuisine: string;
  rarity: Rarity;
  reason: string;
  estimatedMealCents: number;
  xp: number;
  potentialRewardCents: number;
  coordinates: Coordinates;
};

export type AdventurePlan = {
  id: string;
  routeKind: "estimate";
  totalEstimatedMealCents: number;
  totalXp: number;
  totalPotentialRewardCents: number;
  totalWalkMinutes: number;
  stops: AdventureStop[];
  route: [number, number][];
  /** Live mode only: which services ranked candidates and picked the stops. */
  engine?: {
    planner: string;
    mode: "live" | "fallback";
    explanation: string;
    ranking: string;
    rankingSource: "moss" | "catalog";
  };
};

export type StreamEvent =
  | { type: "progress"; stage: string; message: string }
  | { type: "complete"; plan: AdventurePlan }
  | {
      type: "error";
      error: { code: string; message: string; retryable: boolean };
    };

export type NearbyQuery = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

import type {
  AdventureRequest,
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
  CollectionResponse,
} from "@/lib/contracts";

export type RelayApi = {
  ensureSession(): Promise<SessionResponse>;
  getSummary(): Promise<Summary>;
  getNearby(query: NearbyQuery): Promise<NearbyResponse>;
  getCollection(): Promise<CollectionResponse>;
  getWallet(): Promise<WalletResponse>;
  createVisit(body: VisitRequest, idempotencyKey: string): Promise<VisitResponse>;
  createRedemption(body: RedemptionRequest, idempotencyKey: string): Promise<RedemptionResponse>;
  streamAdventure(
    body: AdventureRequest,
    signal: AbortSignal,
    onEvent: (event: StreamEvent) => void,
  ): Promise<void>;
  resetDemo(): Promise<SessionResponse>;
};

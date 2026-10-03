import { ApiError } from "@/lib/api-error";
import type {
  AdventureRequest,
  CollectionResponse,
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
import type { RelayApi } from "@/lib/client/types";
import {
  earnedToday,
  toBackendAdventure,
  toBackendRedemption,
  toBackendVisit,
  toCollectionResponse,
  toLedger,
  toNearbyResponse,
  toRestaurant,
  toStreamEvent,
  toSummary,
  toUiErrorCode,
  toWalletResponse,
  type BackendCollectionResponse,
  type BackendNearbyResponse,
  type BackendRedemptionResponse,
  type BackendSessionResponse,
  type BackendStreamEvent,
  type BackendSummary,
  type BackendVisitResponse,
  type BackendWalletResponse,
} from "@/lib/client/backend-adapter";
import type { Restaurant } from "@/lib/contracts";
import { REDEEM_SUCCESS_MESSAGE } from "@/lib/rules";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError("NETWORK", "Couldn't reach Relay. Retry the same confirmation.", {
        retryable: true,
        status: response.status,
      });
    }
  }
  if (!response.ok) {
    const body = data as { error?: { code?: string; message?: string; retryable?: boolean; details?: unknown } } | null;
    const error = body?.error;
    if (error?.code) {
      throw new ApiError(toUiErrorCode(error.code), error.message ?? error.code, {
        retryable: Boolean(error.retryable),
        status: response.status,
        details: error.details,
      });
    }
    throw new ApiError("HTTP_ERROR", "The server couldn't complete that.", {
      retryable: response.status >= 500,
      status: response.status,
    });
  }
  return data as T;
}

function parseFrames(buffer: string, flush: boolean): { events: { event: string; data: string }[]; rest: string } {
  const chunks = buffer.split(/\n\n/);
  const rest = flush ? "" : (chunks.pop() ?? "");
  const events: { event: string; data: string }[] = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of chunk.split(/\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length > 0) events.push({ event, data: dataLines.join("\n") });
  }
  return { events, rest: flush ? "" : rest };
}

export function createHttpApi(base = "/api/v1"): RelayApi {
  async function send<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        credentials: "same-origin",
        ...init,
        headers: {
          accept: "application/json",
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers,
        },
      });
    } catch {
      throw new ApiError("NETWORK", "Couldn't reach Relay. Retry the same confirmation.", {
        retryable: true,
        status: 0,
      });
    }
    return readJson<T>(response);
  }

  let sessionId: string | null = null;
  const catalog = new Map<string, Restaurant>();
  const remember = (restaurants: Restaurant[]) => {
    for (const restaurant of restaurants) catalog.set(restaurant.id, restaurant);
  };

  async function ensureSession(): Promise<SessionResponse> {
    const body = await send<BackendSessionResponse>("/session/demo", { method: "POST" });
    sessionId = body.sessionId;
    return { sessionId: body.sessionId, verificationMode: "demo", rewardFunding: "platform" };
  }

  /** Stops carry only ids; route point i+1 is stop i, so look up unknown venues right there. */
  async function resolveStops(event: Extract<BackendStreamEvent, { type: "complete" }>) {
    await Promise.all(
      event.plan.stops.map(async (stop, index) => {
        const point = event.plan.route[index + 1];
        if (catalog.has(stop.restaurantId) || !point) return;
        const nearby = await send<BackendNearbyResponse>(
          `/restaurants/nearby?latitude=${point[1]}&longitude=${point[0]}&radiusMeters=100`,
        );
        remember(nearby.restaurants.map(toRestaurant));
      }),
    );
  }

  async function fullSummary(known?: BackendSummary): Promise<Summary> {
    const [summary, collection, wallet] = await Promise.all([
      known ?? send<BackendSummary>("/me"),
      send<BackendCollectionResponse>("/collection"),
      send<BackendWalletResponse>("/wallet"),
    ]);
    if (!sessionId) await ensureSession();
    return toSummary(summary, {
      sessionId: sessionId ?? "",
      collectedCount: collection.count,
      earnedTodayCents: earnedToday(toLedger(wallet)),
    });
  }

  return {
    ensureSession,
    getSummary() {
      return fullSummary();
    },
    async getNearby(query: NearbyQuery) {
      const params = new URLSearchParams({
        latitude: String(query.latitude),
        longitude: String(query.longitude),
        radiusMeters: String(Math.min(10_000, Math.max(100, Math.round(query.radiusMeters)))),
      });
      const [nearby, wallet] = await Promise.all([
        send<BackendNearbyResponse>(`/restaurants/nearby?${params.toString()}`),
        send<BackendWalletResponse>("/wallet"),
      ]);
      const result: NearbyResponse = toNearbyResponse(nearby, toLedger(wallet));
      remember(result.restaurants);
      return result;
    },
    async getCollection() {
      const result: CollectionResponse = toCollectionResponse(await send<BackendCollectionResponse>("/collection"));
      remember(result.restaurants);
      return result;
    },
    async getWallet() {
      const result: WalletResponse = toWalletResponse(await send<BackendWalletResponse>("/wallet"));
      return result;
    },
    async createVisit(body: VisitRequest, idempotencyKey: string): Promise<VisitResponse> {
      const visit = await send<BackendVisitResponse>("/visits", {
        method: "POST",
        body: JSON.stringify(toBackendVisit(body)),
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const summary = await fullSummary(visit.summary);
      return {
        visitId: visit.visitId,
        restaurantId: visit.restaurantId,
        receiptId: body.receiptId,
        xpAwarded: visit.xpAwarded,
        creditAwardedCents: visit.creditAwardedCents,
        firstDiscovery: visit.firstDiscovery,
        leveledUp: visit.xpAwarded > 0 && visit.summary.xpIntoLevel < visit.xpAwarded,
        levelAfter: visit.summary.level,
        summary,
        replayed: false,
      };
    },
    async createRedemption(body: RedemptionRequest, idempotencyKey: string): Promise<RedemptionResponse> {
      const redemption = await send<BackendRedemptionResponse>("/redemptions", {
        method: "POST",
        body: JSON.stringify(toBackendRedemption(body)),
        headers: { "Idempotency-Key": idempotencyKey },
      });
      return {
        redemptionId: redemption.redemptionId,
        restaurantId: redemption.restaurantId,
        settlementStatus: redemption.settlementStatus,
        rewardAmountCents: redemption.amountCents,
        balanceCents: redemption.summary.balanceCents,
        message: REDEEM_SUCCESS_MESSAGE,
        summary: await fullSummary(redemption.summary),
        replayed: false,
      };
    },
    async streamAdventure(body: AdventureRequest, signal: AbortSignal, onEvent) {
      let response: Response;
      try {
        response = await fetch(`${base}/adventures/stream`, {
          method: "POST",
          credentials: "same-origin",
          signal,
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify(toBackendAdventure(body)),
        });
      } catch (error) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        throw new ApiError("NETWORK", "Couldn't reach Relay.", { retryable: true, status: 0 });
      }
      if (!response.ok) {
        await readJson(response);
        return;
      }
      if (!response.body) {
        throw new ApiError("INCOMPLETE_STREAM", "Planning stopped before a route was ready. Try again.", {
          retryable: true,
          status: 200,
        });
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let terminal = false;
      const handle = async (eventName: string, data: string) => {
        const raw = JSON.parse(data) as BackendStreamEvent;
        if (raw.type === "complete") await resolveStops(raw);
        const parsed: StreamEvent = toStreamEvent(raw, catalog);
        if (parsed.type === "complete" || parsed.type === "error" || eventName === "complete" || eventName === "error") {
          terminal = true;
        }
        onEvent(parsed);
      };
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const parsed = parseFrames(buffer, done);
        buffer = parsed.rest;
        for (const frame of parsed.events) await handle(frame.event, frame.data);
        if (done) break;
      }
      if (!terminal) {
        throw new ApiError("INCOMPLETE_STREAM", "Planning stopped before a route was ready. Try again.", {
          retryable: true,
          status: 200,
        });
      }
    },
    async resetDemo() {
      throw new ApiError("RESET_UNAVAILABLE", "Reset is only available in the mock demo.", {
        retryable: false,
        status: 403,
      });
    },
  };
}

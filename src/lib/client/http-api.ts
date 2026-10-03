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
import type { BiteQuestApi } from "@/lib/client/types";

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
      throw new ApiError(error.code, error.message ?? error.code, {
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

export function createHttpApi(base = "/api/v1"): BiteQuestApi {
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

  return {
    ensureSession() {
      return send<SessionResponse>("/session/demo", { method: "POST" });
    },
    getSummary() {
      return send<Summary>("/me");
    },
    getNearby(query: NearbyQuery) {
      const params = new URLSearchParams({
        latitude: String(query.latitude),
        longitude: String(query.longitude),
        radiusMeters: String(query.radiusMeters),
      });
      return send<NearbyResponse>(`/restaurants/nearby?${params.toString()}`);
    },
    getCollection() {
      return send<CollectionResponse>("/collection");
    },
    getWallet() {
      return send<WalletResponse>("/wallet");
    },
    createVisit(body: VisitRequest, idempotencyKey: string) {
      return send<VisitResponse>("/visits", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": idempotencyKey },
      });
    },
    createRedemption(body: RedemptionRequest, idempotencyKey: string) {
      return send<RedemptionResponse>("/redemptions", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": idempotencyKey },
      });
    },
    async streamAdventure(body: AdventureRequest, signal: AbortSignal, onEvent) {
      let response: Response;
      try {
        response = await fetch(`${base}/adventures/stream`, {
          method: "POST",
          credentials: "same-origin",
          signal,
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify(body),
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
      const handle = (eventName: string, data: string) => {
        const parsed = JSON.parse(data) as StreamEvent;
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
        for (const frame of parsed.events) handle(frame.event, frame.data);
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

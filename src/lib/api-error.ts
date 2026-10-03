const COPY: Record<string, string> = {
  LOCATION_TOO_FAR: "Move closer or use the labeled demo location action",
  LOCATION_STALE: "Refresh your location and try again",
  LOCATION_INACCURATE: "Refresh your location and try again",
  ALREADY_EARNED_TODAY: "This restaurant has already earned today's reward",
  DAILY_REWARD_CAP: "Today's $2 reward limit has been reached",
  PURCHASE_TOO_SMALL: "Enter a demo bill of at least $5",
  UNAUTHENTICATED: "Reload to establish a demo session",
  IDEMPOTENCY_CONFLICT: "Start a new confirmation for the changed request",
  INSUFFICIENT_BALANCE: "Lower the reward amount. It can't be more than your balance.",
  PORTABILITY_REQUIRED:
    "Earn a reward at a different restaurant first. Credits are portable — spend them somewhere else.",
  REWARD_LIMIT: "Use at most the lesser of your bill and $5.",
  REWARD_TOO_SMALL: "Enter a reward of at least $0.01.",
  NOT_FOUND: "That restaurant isn't in the demo catalog.",
  NETWORK: "Couldn't reach Relay. Retry the same confirmation.",
  INCOMPLETE_STREAM: "Planning stopped before a route was ready. Try again.",
};

export class ApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    options?: { retryable?: boolean; status?: number; details?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.status = options?.status ?? 400;
    this.details = options?.details;
  }
}

export function fail(
  code: string,
  status: number,
  message = COPY[code] ?? code,
  retryable = false,
): never {
  throw new ApiError(code, message, { status, retryable });
}

export function userMessage(error: unknown): string {
  if (error instanceof ApiError) return COPY[error.code] ?? error.message;
  if (error instanceof DOMException && error.name === "AbortError") return "Planning cancelled.";
  if (error instanceof Error && error.name === "AbortError") return "Planning cancelled.";
  return "Something went wrong. Please try again.";
}

export function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

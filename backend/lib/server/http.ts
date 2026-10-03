import { ApiProblem } from "./errors";

const FORBIDDEN_LOG_KEYS = new Set(["cookie", "cookies", "authorization", "receiptId", "demoReceiptId", "latitude", "longitude", "location", "body"]);

export function jsonError(problem: ApiProblem): Response {
  return Response.json({ error: problem.toJSON() }, { status: problem.status });
}

export function routeError(error: unknown): Response {
  if (error instanceof ApiProblem) return jsonError(error);
  return jsonError(new ApiProblem("SERVICE_UNAVAILABLE", "Service is temporarily unavailable", { retryable: true }));
}

export function sanitizeLog(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !FORBIDDEN_LOG_KEYS.has(key)));
}

export async function withRequestContext(route: string, handler: (requestId: string) => Promise<Response>): Promise<Response> {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  let response: Response;
  try {
    response = await handler(requestId);
  } catch (error) {
    response = routeError(error);
  }
  console.info(JSON.stringify(sanitizeLog({ requestId, route, status: response.status, latencyMs: Math.round(performance.now() - started) })));
  response.headers.set("x-request-id", requestId);
  return response;
}

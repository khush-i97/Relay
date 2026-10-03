import { ApiProblem } from "./errors";

export function validateWriteOrigin(request: Request, configuredOrigin = process.env.APP_ORIGIN): void {
  const origin = request.headers.get("origin");
  const allowed = new Set([new URL(request.url).origin, configuredOrigin].filter(Boolean));
  if (!origin || !allowed.has(origin)) {
    throw new ApiProblem("ORIGIN_FORBIDDEN", "Request origin is not allowed");
  }
}

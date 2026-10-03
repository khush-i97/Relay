import { ApiProblem } from "./errors";
import { serverDb } from "./supabase";

export async function consumeRateLimit(userId: string, category: "planning" | "mutation", limit: number): Promise<boolean> {
  const { data, error } = await serverDb().rpc("consume_rate_limit", {
    p_user_id: userId,
    p_category: category,
    p_limit: limit,
  });
  if (error) throw new ApiProblem("SERVICE_UNAVAILABLE", "Rate limiter is unavailable", { retryable: true });
  return data === true;
}

export async function requireRateLimit(userId: string, category: "planning" | "mutation", limit: number): Promise<void> {
  if (!(await consumeRateLimit(userId, category, limit))) {
    throw new ApiProblem("RATE_LIMITED", "Too many requests", { retryable: true });
  }
}

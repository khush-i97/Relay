import type { RedemptionRequest, VisitRequest } from "../../shared/contracts";
import { canonicalHash } from "./domain/canonical-json";
import { ApiProblem } from "./errors";
import { requireRateLimit } from "./rate-limit";
import { requireSession } from "./session";
import { serverDb } from "./supabase";
import { redemptionRequestSchema, validateVisitLocation, visitRequestSchema } from "./validation";

type MutationResult = { ok: boolean; status: number; response?: unknown; error?: unknown };

export async function handleVisit(request: Request): Promise<Response> {
  assertDemoMode();
  const session = await requireSession(request);
  const key = idempotencyKey(request);
  const raw = await readJson(request);
  const parsed = visitRequestSchema.safeParse(raw);
  if (!parsed.success) throw visitValidationProblem(parsed.error.issues);
  const payload = parsed.data as VisitRequest;
  const requestHash = await canonicalHash(payload);
  const replay = await idempotencyReplay(session.userId, "visit", key, requestHash);
  if (replay) return mutationResponse(replay);
  await requireRateLimit(session.userId, "mutation", 30);

  const db = serverDb();
  const { data: restaurant, error: restaurantError } = await db
    .from("restaurants")
    .select("latitude,longitude")
    .eq("id", payload.restaurantId)
    .maybeSingle();
  if (restaurantError) throw restaurantError;
  if (!restaurant) throw new ApiProblem("RESTAURANT_NOT_FOUND", "Restaurant was not found");
  validateVisitLocation(payload.location, { latitude: restaurant.latitude, longitude: restaurant.longitude });

  const { data, error } = await db.rpc("record_visit", {
    p_user_id: session.userId,
    p_key: key,
    p_request_hash: requestHash,
    p_restaurant_id: payload.restaurantId,
    p_receipt_id: payload.demoPurchase.receiptId,
    p_bill_cents: payload.demoPurchase.billCents,
  });
  if (error) throw error;
  return mutationResponse(data as MutationResult);
}

export async function handleRedemption(request: Request): Promise<Response> {
  assertDemoMode();
  const session = await requireSession(request);
  const key = idempotencyKey(request);
  const raw = await readJson(request);
  const parsed = redemptionRequestSchema.safeParse(raw);
  if (!parsed.success) throw new ApiProblem("INVALID_REQUEST", "Redemption request is invalid", { details: { issues: parsed.error.issues } });
  const payload = parsed.data as RedemptionRequest;
  const requestHash = await canonicalHash(payload);
  const replay = await idempotencyReplay(session.userId, "redemption", key, requestHash);
  if (replay) return mutationResponse(replay);
  await requireRateLimit(session.userId, "mutation", 30);

  const { data, error } = await serverDb().rpc("record_redemption", {
    p_user_id: session.userId,
    p_key: key,
    p_request_hash: requestHash,
    p_restaurant_id: payload.restaurantId,
    p_demo_receipt_id: payload.demoReceiptId,
    p_bill_cents: payload.billCents,
    p_amount_cents: payload.amountCents,
  });
  if (error) throw error;
  return mutationResponse(data as MutationResult);
}

function assertDemoMode(): void {
  if (process.env.DEMO_MODE !== "true") {
    throw new ApiProblem("DEMO_MODE_DISABLED", "Simulated mutations are disabled");
  }
}

function idempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length > 255) throw new ApiProblem("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required");
  return key;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiProblem("INVALID_REQUEST", "Request body must be valid JSON");
  }
}

async function idempotencyReplay(userId: string, operation: "visit" | "redemption", key: string, requestHash: string): Promise<MutationResult | null> {
  const { data, error } = await serverDb().rpc("get_idempotency_replay", {
    p_user_id: userId,
    p_operation: operation,
    p_key: key,
    p_request_hash: requestHash,
  });
  if (error) throw error;
  return data as MutationResult | null;
}

function mutationResponse(result: MutationResult): Response {
  if (result.ok && result.response) return Response.json(result.response, { status: result.status });
  return Response.json({ error: result.error }, { status: result.status });
}

function visitValidationProblem(issues: { path: PropertyKey[] }[]): ApiProblem {
  if (issues.some(({ path }) => path.join(".") === "demoPurchase.billCents")) {
    return new ApiProblem("PURCHASE_TOO_SMALL", "Demo bill must be at least 500 cents");
  }
  if (issues.some(({ path }) => path.join(".") === "location.accuracyMeters")) {
    return new ApiProblem("LOCATION_INACCURATE", "Location accuracy must be within 100 meters");
  }
  return new ApiProblem("INVALID_REQUEST", "Visit request is invalid", { details: { issues } });
}

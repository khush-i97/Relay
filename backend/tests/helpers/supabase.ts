import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Integration tests require local SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

export const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function freshUser(): Promise<string> {
  const userId = crypto.randomUUID();
  const { error } = await admin.from("profiles").insert({ user_id: userId, total_xp: 0 });
  if (error) throw error;
  return userId;
}

export async function resetUserData(): Promise<void> {
  for (const table of ["idempotency_records", "wallet_transactions", "redemptions", "discoveries", "visits", "rate_limit_events", "demo_sessions", "profiles"]) {
    const { error } = await admin.from(table).delete().not("user_id", "is", null);
    if (error && !["demo_sessions", "rate_limit_events"].includes(table)) throw error;
  }
}

export function visit(
  userId: string,
  options: Partial<{ key: string; hash: string; receiptId: string; restaurantId: string; now: string; fail: boolean }> = {},
) {
  return admin.rpc("record_visit", {
    p_user_id: userId,
    p_key: options.key ?? crypto.randomUUID(),
    p_request_hash: options.hash ?? crypto.randomUUID(),
    p_restaurant_id: options.restaurantId ?? "demo-mission-taco",
    p_receipt_id: options.receiptId ?? crypto.randomUUID(),
    p_bill_cents: 500,
    p_now: options.now ?? "2026-10-03T20:00:00.000Z",
    p_fail_after_visit: options.fail ?? false,
  });
}

export function redeem(
  userId: string,
  options: Partial<{ key: string; hash: string; receiptId: string; restaurantId: string; amountCents: number }> = {},
) {
  return admin.rpc("record_redemption", {
    p_user_id: userId,
    p_key: options.key ?? crypto.randomUUID(),
    p_request_hash: options.hash ?? crypto.randomUUID(),
    p_restaurant_id: options.restaurantId ?? "demo-sunset-ramen",
    p_demo_receipt_id: options.receiptId ?? crypto.randomUUID(),
    p_bill_cents: 500,
    p_amount_cents: options.amountCents ?? 30,
    p_now: "2026-10-03T20:05:00.000Z",
  });
}

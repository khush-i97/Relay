import { beforeEach, describe, expect, it } from "vitest";

import { admin, freshUser, redeem, resetUserData, visit } from "../helpers/supabase";

beforeEach(resetUserData);

describe("database contract", () => {
  it("seeds the stable synthetic catalog", async () => {
    const { data, error, count } = await admin.from("restaurants").select("id", { count: "exact" });
    expect(error).toBeNull();
    expect(count).toBe(18);
    expect(data?.map(({ id }) => id)).toContain("demo-mission-taco");
  });

  it("creates or resumes a demo session without resetting its profile", async () => {
    const tokenHash = "a".repeat(64);
    const first = await admin.rpc("create_or_resume_demo_session", { p_token_hash: tokenHash, p_session_id: crypto.randomUUID(), p_now: "2026-10-03T20:00:00Z" });
    expect(first.error).toBeNull();
    const second = await admin.rpc("create_or_resume_demo_session", { p_token_hash: tokenHash, p_session_id: crypto.randomUUID(), p_now: "2026-10-03T20:05:00Z" });
    expect(second.data).toEqual(first.data);
  });

  it("records one atomic first discovery and returns the ledger-backed summary", async () => {
    const userId = await freshUser();
    const result = await visit(userId, { key: "visit-key", hash: "payload-hash", receiptId: "receipt-a" });
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ ok: true, status: 201, response: { firstDiscovery: true, xpAwarded: 150, creditAwardedCents: 50, summary: { balanceCents: 50 } } });
    const [visits, discoveries, ledger] = await Promise.all([
      admin.from("visits").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("discoveries").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("wallet_transactions").select("delta_cents").eq("user_id", userId),
    ]);
    expect(visits.count).toBe(1);
    expect(discoveries.count).toBe(1);
    expect(ledger.data).toEqual([{ delta_cents: 50 }]);
  });

  it("replays identical input and rejects a changed payload or reused receipt", async () => {
    const userId = await freshUser();
    const first = await visit(userId, { key: "same-key", hash: "same-hash", receiptId: "receipt-a" });
    const replay = await visit(userId, { key: "same-key", hash: "same-hash", receiptId: "receipt-a" });
    const conflict = await visit(userId, { key: "same-key", hash: "changed-hash", receiptId: "receipt-b" });
    const reused = await visit(userId, { key: "new-key", hash: "new-hash", receiptId: "receipt-a", restaurantId: "demo-soma-curry" });
    expect(replay.data).toEqual(first.data);
    expect(conflict.data).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(reused.data).toMatchObject({ ok: false, error: { code: "RECEIPT_ALREADY_USED" } });
  });

  it("serializes concurrent first visits and enforces the daily cap", async () => {
    const userId = await freshUser();
    const simultaneous = await Promise.all([
      visit(userId, { receiptId: "concurrent-a", hash: "hash-a" }),
      visit(userId, { receiptId: "concurrent-b", hash: "hash-b" }),
    ]);
    expect(simultaneous.filter(({ data }) => data?.ok)).toHaveLength(1);
    for (const [index, restaurantId] of ["demo-soma-curry", "demo-castro-bakery", "demo-haight-bowls"].entries()) {
      const result = await visit(userId, { restaurantId, receiptId: `cap-${index}`, hash: `cap-hash-${index}` });
      expect(result.data?.ok).toBe(true);
    }
    const capped = await visit(userId, { restaurantId: "demo-northbeach-pizza", receiptId: "cap-4", hash: "cap-hash-4" });
    expect(capped.data).toMatchObject({ ok: false, error: { code: "DAILY_REWARD_CAP" } });
  });

  it("awards a later-day repeat credit without discovery XP", async () => {
    const userId = await freshUser();
    await visit(userId, { receiptId: "day-one" });
    const later = await visit(userId, { receiptId: "day-two", now: "2026-10-04T20:00:00Z" });
    expect(later.data).toMatchObject({ ok: true, response: { firstDiscovery: false, xpAwarded: 0, creditAwardedCents: 50, summary: { balanceCents: 100 } } });
  });

  it("requires portability and prevents concurrent overspending", async () => {
    const userId = await freshUser();
    await visit(userId, { receiptId: "earn-a" });
    const sameVenue = await redeem(userId, { restaurantId: "demo-mission-taco", receiptId: "same-venue", amountCents: 30 });
    expect(sameVenue.data).toMatchObject({ ok: false, error: { code: "PORTABILITY_REQUIRED" } });
    const results = await Promise.all([
      redeem(userId, { receiptId: "redeem-a", amountCents: 40 }),
      redeem(userId, { receiptId: "redeem-b", amountCents: 40 }),
    ]);
    expect(results.filter(({ data }) => data?.ok)).toHaveLength(1);
    const summary = await admin.rpc("get_summary", { p_user_id: userId });
    expect(summary.data.balanceCents).toBe(10);
  });

  it("rolls back every row when a visit fails after insertion", async () => {
    const userId = await freshUser();
    const result = await visit(userId, { receiptId: "rollback", fail: true });
    expect(result.error).not.toBeNull();
    const [visits, discoveries, ledger, profile, idempotency] = await Promise.all([
      admin.from("visits").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("discoveries").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("wallet_transactions").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("profiles").select("total_xp").eq("user_id", userId).single(),
      admin.from("idempotency_records").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    expect([visits.count, discoveries.count, ledger.count, idempotency.count]).toEqual([0, 0, 0, 0]);
    expect(profile.data?.total_xp).toBe(0);
  });
});

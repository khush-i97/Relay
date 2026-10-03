import { routeError } from "../../../../lib/server/http";
import { requireSession } from "../../../../lib/server/session";
import { serverDb } from "../../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    const db = serverDb();
    const [{ data: summary, error: summaryError }, { data: rows, error }] = await Promise.all([
      db.rpc("get_summary", { p_user_id: session.userId }),
      db.from("wallet_transactions").select("id,restaurant_id,kind,delta_cents,created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (summaryError || error) throw summaryError ?? error;
    const ids = [...new Set((rows ?? []).map((row) => row.restaurant_id))];
    const { data: restaurants } = ids.length ? await db.from("restaurants").select("id,name").in("id", ids) : { data: [] };
    const names = new Map((restaurants ?? []).map((row) => [row.id, row.name]));
    const transactions = (rows ?? []).map((row) => ({ id: row.id, restaurantId: row.restaurant_id, restaurantName: names.get(row.restaurant_id) ?? "Unknown restaurant", kind: row.kind, deltaCents: row.delta_cents, createdAt: row.created_at }));
    return Response.json({ summary, transactions });
  } catch (error) {
    return routeError(error);
  }
}

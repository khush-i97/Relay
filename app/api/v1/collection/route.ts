import { routeError } from "../../../../lib/server/http";
import { mapRestaurant } from "../../../../lib/server/restaurants";
import { requireSession } from "../../../../lib/server/session";
import { serverDb } from "../../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    const db = serverDb();
    const { data: rows, error } = await db.from("discoveries").select("restaurant_id,first_visit_id,discovered_at").eq("user_id", session.userId).order("discovered_at", { ascending: false });
    if (error) throw error;
    const ids = (rows ?? []).map((row) => row.restaurant_id);
    const { data: restaurantRows, error: restaurantError } = ids.length ? await db.from("restaurants").select("*").in("id", ids) : { data: [], error: null };
    if (restaurantError) throw restaurantError;
    const byId = new Map((restaurantRows ?? []).map((row) => [row.id, mapRestaurant(row)]));
    const discoveries = (rows ?? []).map((row) => ({ restaurant: byId.get(row.restaurant_id), discoveredAt: row.discovered_at, firstVisitId: row.first_visit_id }));
    return Response.json({ discoveries, count: discoveries.length });
  } catch (error) {
    return routeError(error);
  }
}

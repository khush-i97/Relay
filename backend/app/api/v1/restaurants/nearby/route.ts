import { haversineMeters } from "../../../../../lib/server/domain/geo";
import { sfLocalDate } from "../../../../../lib/server/domain/time";
import { ApiProblem } from "../../../../../lib/server/errors";
import { routeError } from "../../../../../lib/server/http";
import { mapRestaurant } from "../../../../../lib/server/restaurants";
import { requireSession } from "../../../../../lib/server/session";
import { serverDb } from "../../../../../lib/server/supabase";
import { nearbyQuerySchema } from "../../../../../lib/server/validation";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    const url = new URL(request.url);
    const parsed = nearbyQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new ApiProblem("INVALID_REQUEST", "Nearby query is invalid", { details: { issues: parsed.error.issues } });
    const center = { latitude: parsed.data.latitude, longitude: parsed.data.longitude };
    const db = serverDb();
    const [{ data: rows, error }, { data: discoveries }, { data: todayVisits }] = await Promise.all([
      db.from("restaurants").select("*"),
      db.from("discoveries").select("restaurant_id").eq("user_id", session.userId),
      db.from("visits").select("restaurant_id,credit_awarded_cents").eq("user_id", session.userId).eq("local_date", sfLocalDate(new Date())),
    ]);
    if (error) throw error;
    const discovered = new Set((discoveries ?? []).map((row) => row.restaurant_id));
    const visitedToday = new Set((todayVisits ?? []).map((row) => row.restaurant_id));
    const dailyCredits = (todayVisits ?? []).reduce((sum, row) => sum + Number(row.credit_awarded_cents), 0);
    const restaurants = (rows ?? [])
      .map((row) => {
        const restaurant = mapRestaurant(row);
        return { ...restaurant, distanceMeters: Math.round(haversineMeters(center, restaurant)), discovered: discovered.has(restaurant.id), rewardEligibleToday: !visitedToday.has(restaurant.id) && dailyCredits + restaurant.rewardCents <= 200 };
      })
      .filter(({ distanceMeters }) => distanceMeters <= parsed.data.radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    return Response.json({ center, radiusMeters: parsed.data.radiusMeters, restaurants });
  } catch (error) {
    return routeError(error);
  }
}

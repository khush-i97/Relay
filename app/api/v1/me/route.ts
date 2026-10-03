import { routeError } from "../../../../lib/server/http";
import { requireSession } from "../../../../lib/server/session";
import { serverDb } from "../../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    const { data, error } = await serverDb().rpc("get_summary", { p_user_id: session.userId });
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return routeError(error);
  }
}

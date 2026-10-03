import { serverConfig } from "../../../../../lib/server/config";
import { ApiProblem } from "../../../../../lib/server/errors";
import { routeError } from "../../../../../lib/server/http";
import { validateWriteOrigin } from "../../../../../lib/server/origin";
import { hashSessionToken, newSessionToken, requireSession, SESSION_COOKIE, sessionCookie } from "../../../../../lib/server/session";
import { serverDb } from "../../../../../lib/server/supabase";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    validateWriteOrigin(request, serverConfig().appOrigin);
    const existingToken = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    if (existingToken) {
      try {
        const existing = await requireSession(request);
        const { data: summary, error } = await serverDb().rpc("get_summary", { p_user_id: existing.userId });
        if (error) throw error;
        return Response.json({ sessionId: existing.sessionId, summary });
      } catch (error) {
        if (!(error instanceof ApiProblem) || error.code !== "UNAUTHENTICATED") throw error;
      }
    }

    const token = newSessionToken();
    const { data, error } = await serverDb().rpc("create_or_resume_demo_session", {
      p_token_hash: await hashSessionToken(token),
      p_session_id: crypto.randomUUID(),
    });
    if (error || !data) throw new ApiProblem("SERVICE_UNAVAILABLE", "Could not create demo session", { retryable: true });
    return Response.json(
      { sessionId: data.sessionId, summary: data.summary },
      { status: 200, headers: { "set-cookie": sessionCookie(token, request) } },
    );
  } catch (error) {
    return routeError(error);
  }
}

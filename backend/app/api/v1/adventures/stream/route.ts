import { planAdventure } from "../../../../../lib/server/adventure/planner";
import { encodeSse } from "../../../../../lib/server/adventure/sse";
import { sfLocalDate } from "../../../../../lib/server/domain/time";
import { ApiProblem } from "../../../../../lib/server/errors";
import { routeError } from "../../../../../lib/server/http";
import { logEvent } from "../../../../../lib/server/log";
import { validateWriteOrigin } from "../../../../../lib/server/origin";
import { configuredPlanningProvider } from "../../../../../lib/server/providers";
import { MossRanker } from "../../../../../lib/server/providers/moss";
import { TavilyEnricher } from "../../../../../lib/server/providers/tavily";
import { withProviderTimeout, type PlanningCandidate } from "../../../../../lib/server/providers/types";
import { requireRateLimit } from "../../../../../lib/server/rate-limit";
import { mapRestaurant } from "../../../../../lib/server/restaurants";
import { requireSession } from "../../../../../lib/server/session";
import { serverDb } from "../../../../../lib/server/supabase";
import { adventureRequestSchema } from "../../../../../lib/server/validation";
import type { AdventurePlan, AdventureStreamEvent } from "../../../../../shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    validateWriteOrigin(request);
    const session = await requireSession(request);
    await requireRateLimit(session.userId, "planning", 10);
    const parsed = adventureRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiProblem("INVALID_REQUEST", "Adventure request is invalid", { details: { issues: parsed.error.issues } });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let terminalSent = false;
        const planningSignal = AbortSignal.any([request.signal, AbortSignal.timeout(44_000)]);
        const send = (event: AdventureStreamEvent) => controller.enqueue(encoder.encode(encodeSse(event)));
        try {
          const db = serverDb();
          const [{ data: rows, error }, { data: discoveries }, { data: todayVisits }] = await Promise.all([
            db.from("restaurants").select("*"),
            db.from("discoveries").select("restaurant_id").eq("user_id", session.userId),
            db.from("visits").select("restaurant_id,credit_awarded_cents").eq("user_id", session.userId).eq("local_date", sfLocalDate(new Date())),
          ]);
          if (error) throw error;
          const discovered = new Set((discoveries ?? []).map((row) => row.restaurant_id));
          const visitedToday = new Set((todayVisits ?? []).map((row) => row.restaurant_id));
          const currentDailyCredits = (todayVisits ?? []).reduce((sum, row) => sum + Number(row.credit_awarded_cents), 0);
          let candidates: PlanningCandidate[] = (rows ?? []).map((row) => {
            const restaurant = mapRestaurant(row);
            return { ...restaurant, discovered: discovered.has(restaurant.id), rewardEligibleToday: !visitedToday.has(restaurant.id) && currentDailyCredits + restaurant.rewardCents <= 200 };
          });
          send({ type: "progress", stage: "catalog_loaded", message: "Catalog and reward state loaded" });

          const started = performance.now();
          let ranking: NonNullable<AdventurePlan["ranking"]> = { source: "catalog", reason: "Moss is not configured", topRestaurantIds: [] };
          if (!process.env.MOSS_PROJECT_ID || !process.env.MOSS_PROJECT_KEY) {
            // keep catalog order
          } else if (parsed.data.preferences.length === 0) {
            ranking = { ...ranking, reason: "No preferences given, so Moss was skipped" };
          } else {
            try {
              candidates = await withProviderTimeout(
                () => new MossRanker(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!).rank(candidates, parsed.data.preferences),
                12_000, // a cold serverless instance downloads the embedding model first
                planningSignal,
              );
              ranking = { source: "moss", reason: `Ranked by Moss for "${parsed.data.preferences.join(", ")}"`, topRestaurantIds: candidates.slice(0, 5).map((candidate) => candidate.id) };
            } catch (error) {
              ranking = { ...ranking, reason: `Moss failed: ${error instanceof Error ? error.message : String(error)}` };
            }
          }
          send({ type: "progress", stage: "candidates_ranked", message: "Candidates ranked" });

          const sources = process.env.TAVILY_API_KEY
            ? await withProviderTimeout((signal) => new TavilyEnricher(process.env.TAVILY_API_KEY!).enrich(candidates, signal), 5_000, planningSignal).catch(() => [])
            : [];
          const plan = { ...(await planAdventure(parsed.data, { candidates, currentDailyCredits, provider: configuredPlanningProvider(), sources }, planningSignal)), ranking };
          logEvent({
            event: "adventure.planned",
            preferences: parsed.data.preferences,
            ranking: ranking.source,
            rankingReason: ranking.reason,
            mossTop: ranking.topRestaurantIds,
            planner: plan.provider,
            mode: plan.mode,
            stops: plan.stops.map((stop) => stop.restaurantId),
            latencyMs: Math.round(performance.now() - started),
          });
          send({ type: "progress", stage: "plan_validated", message: "Plan validated against catalog limits" });
          send({ type: "complete", plan });
          terminalSent = true;
        } catch (error) {
          logEvent({ event: "adventure.failed", error: error instanceof Error ? error.message : String(error) });
          if (!terminalSent && !request.signal.aborted) {
            send({ type: "error", error: { code: "SERVICE_UNAVAILABLE", message: "Adventure planning is temporarily unavailable", retryable: true } });
          }
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}

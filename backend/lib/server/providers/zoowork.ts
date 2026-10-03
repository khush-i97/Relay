import { assistantText, createZooworkClient, isRunFinished, runOutcome } from "@zoowork-ai/sdk";
import type { AdventureRequest } from "../../../shared/contracts";
import type { PlanningCandidate, PlanningProvider, RankedCandidate } from "./types";
import { withProviderTimeout } from "./types";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type ZooworkClient = ReturnType<typeof createZooworkClient>;

/** Paid ZooData `/v1/systemone` structured-choice API (keys starting with `sk-`). */
export class ZooWorkProvider implements PlanningProvider {
  readonly name = "zoowork" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly endpoint = "https://api.zoowork.ai/v1/systemone",
  ) {}

  async rank(candidates: PlanningCandidate[], input: Required<AdventureRequest>, signal: AbortSignal): Promise<RankedCandidate[]> {
    return withProviderTimeout(async (providerSignal) => {
      const criteria = Object.fromEntries(candidates.map((candidate) => [candidate.id, `${candidate.name}; ${candidate.cuisine}; ${candidate.description}; tags: ${candidate.tags.join(", ")}; meal: ${candidate.estimatedMealCents} cents`]));
      const questions = Object.fromEntries(Array.from({ length: Math.min(input.maxStops, candidates.length) }, (_, index) => [`stop${index + 1}`, {
        type: "choice",
        instructions: `Choose the best ${index + 1 === 1 ? "first" : "next distinct"} restaurant for the requested adventure.`,
        criteria,
      }]));
      const response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.ZOOWORK_MODEL ?? "instinct",
          state: JSON.stringify({ budgetCents: input.maxSpendCents, durationMinutes: input.maxDurationMinutes, preferences: input.preferences }),
          questions,
        }),
        signal: providerSignal,
      });
      if (!response.ok) throw new Error(`ZooWork returned ${response.status}`);
      const body = await response.json() as { answers?: Record<string, { choice?: string }> };
      return Object.values(body.answers ?? {}).flatMap((answer) => typeof answer.choice === "string" ? [{ restaurantId: answer.choice, reason: "Selected by ZooWork Instinct" }] : []);
    }, 15_000, signal);
  }
}

const AGENT_LABELS = { app: "bitequest", role: "adventure-planner", v: "1" };
const AGENT_INSTRUCTIONS = `You are the BiteQuest adventure planner. Each message gives a food-adventure request and a list of candidate restaurants keyed by id.
Rank the candidates that best fit the user's preferences, budget, and time, as a fun walking food crawl.
Reply with ONLY a JSON object, no prose and no code fences, shaped exactly like:
{"stops":[{"restaurantId":"<id from the list>","reason":"<playful reason, at most 15 words>"}]}
Use only ids from the list, never repeat an id, and order stops from best first.`;

/** ZooWork Managed Agents API (keys starting with `zwp_`): one shared planner agent, one session per adventure. */
export class ZooWorkAgentProvider implements PlanningProvider {
  readonly name = "zoowork" as const;
  private static agents = new Map<string, Promise<string>>();
  private readonly client: ZooworkClient;

  constructor(
    apiKey: string,
    private readonly model = process.env.ZOOWORK_AGENT_MODEL || "litellm/gpt-5.6-luna",
  ) {
    this.client = createZooworkClient({ apiKey });
  }

  async rank(candidates: PlanningCandidate[], input: Required<AdventureRequest>, signal: AbortSignal): Promise<RankedCandidate[]> {
    return withProviderTimeout(async (providerSignal) => {
      const agentId = await this.plannerAgent();
      let sessionId: string;
      try {
        ({ session_id: sessionId } = await this.client.createSession(agentId, {}));
      } catch (error) {
        ZooWorkAgentProvider.agents.delete(this.model); // e.g. the agent was stopped; re-provision next time
        throw error;
      }
      try {
        const receipt = await this.client.postEvents(agentId, sessionId, [{ type: "user.message", content: plannerMessage(candidates, input) }]);
        if (receipt.events[0]?.accepted !== true) throw new Error("ZooWork did not accept the planning message");
        let text = "";
        for await (const event of this.client.streamEvents(agentId, sessionId, { signal: providerSignal })) {
          text += assistantText(event);
          if (isRunFinished(event)) {
            if (runOutcome(event) !== "succeeded") throw new Error(`ZooWork turn ${runOutcome(event) ?? "ended"}`);
            return parseRanking(text, candidates);
          }
        }
        throw new Error("ZooWork stream closed before the turn finished");
      } finally {
        void this.client.deleteSession(agentId, sessionId).catch(() => undefined);
      }
    }, 25_000, signal);
  }

  /** Reuses the labelled planner agent across requests and restarts, creating it on first use. */
  private plannerAgent(): Promise<string> {
    let agent = ZooWorkAgentProvider.agents.get(this.model);
    if (!agent) {
      agent = this.provisionAgent();
      agent.catch(() => ZooWorkAgentProvider.agents.delete(this.model));
      ZooWorkAgentProvider.agents.set(this.model, agent);
    }
    return agent;
  }

  private async provisionAgent(): Promise<string> {
    const labels = { ...AGENT_LABELS, model: this.model.replace(/[^a-zA-Z0-9._-]/g, "_") };
    let agentId: string | undefined;
    for await (const agent of this.client.listAgents({ labels })) {
      agentId = agent.agent_id;
      break;
    }
    if (!agentId) {
      const created = await this.client.createAgent({
        resource: {
          name: "bitequest-adventure-planner",
          model: { primary: this.model },
          labels,
          tool_policy: { deny: ["*"] },
          include_global_skills: false,
          persona: { docs: [{ name: "AGENTS.md", content: AGENT_INSTRUCTIONS }] },
        },
      });
      agentId = created.agent_id;
    }
    await this.client.startAgent(agentId);
    await this.client.waitUntilRunning(agentId);
    return agentId;
  }
}

function plannerMessage(candidates: PlanningCandidate[], input: Required<AdventureRequest>): string {
  const list = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    cuisine: candidate.cuisine,
    description: candidate.description,
    tags: candidate.tags,
    rarity: candidate.rarity,
    mealDollars: candidate.estimatedMealCents / 100,
    alreadyDiscovered: candidate.discovered,
  }));
  return JSON.stringify({
    request: {
      preferences: input.preferences.length ? input.preferences : ["surprise me"],
      budgetDollars: input.maxSpendCents / 100,
      maxMinutes: input.maxDurationMinutes,
      stopsWanted: input.maxStops,
      rankUpTo: Math.min(candidates.length, input.maxStops + 2),
    },
    candidates: list,
  });
}

function parseRanking(text: string, candidates: PlanningCandidate[]): RankedCandidate[] {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!json) throw new Error("ZooWork reply did not contain JSON");
  const parsed = JSON.parse(json) as { stops?: { restaurantId?: unknown; reason?: unknown }[] };
  const allowed = new Set(candidates.map((candidate) => candidate.id));
  const seen = new Set<string>();
  const ranking: RankedCandidate[] = [];
  for (const stop of parsed.stops ?? []) {
    if (typeof stop.restaurantId !== "string" || !allowed.has(stop.restaurantId) || seen.has(stop.restaurantId)) continue;
    seen.add(stop.restaurantId);
    const reason = typeof stop.reason === "string" && stop.reason.trim() ? stop.reason.trim().slice(0, 160) : "Picked by ZooWork";
    ranking.push({ restaurantId: stop.restaurantId, reason });
  }
  if (ranking.length === 0) throw new Error("ZooWork returned no usable stops");
  return ranking;
}

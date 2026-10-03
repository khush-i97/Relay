import type { AdventureRequest } from "../../../shared/contracts";
import type { PlanningCandidate, PlanningProvider, RankedCandidate } from "./types";
import { withProviderTimeout } from "./types";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

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

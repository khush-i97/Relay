import type { AdventureRequest } from "../../../shared/contracts";
import type { PlanningCandidate, PlanningProvider, RankedCandidate } from "./types";
import { withProviderTimeout } from "./types";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class NovitaProvider implements PlanningProvider {
  readonly name = "novita" as const;

  constructor(private readonly apiKey: string, private readonly model: string, private readonly fetcher: Fetcher = fetch) {}

  async rank(candidates: PlanningCandidate[], input: Required<AdventureRequest>, signal: AbortSignal): Promise<RankedCandidate[]> {
    return withProviderTimeout(async (providerSignal) => {
      const response = await this.fetcher("https://api.novita.ai/openai/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: 800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Return JSON only: {\"stops\":[{\"restaurantId\":\"catalog id\",\"reason\":\"short reason\"}]}. Use distinct IDs from the supplied catalog only." },
            { role: "user", content: JSON.stringify({ request: input, candidates, maxStops: input.maxStops }) },
          ],
        }),
        signal: providerSignal,
      });
      if (!response.ok) throw new Error(`Novita returned ${response.status}`);
      const body = await response.json() as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error("Novita returned no content");
      const parsed = JSON.parse(content) as { stops?: RankedCandidate[] };
      return parsed.stops ?? [];
    }, 20_000, signal);
  }
}

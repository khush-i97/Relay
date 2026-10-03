import type { PlanningCandidate } from "./types";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class TavilyEnricher {
  constructor(private readonly apiKey: string, private readonly fetcher: Fetcher = fetch) {}

  async enrich(candidates: PlanningCandidate[], signal?: AbortSignal): Promise<{ title: string; url: string }[]> {
    const real = candidates.filter((candidate) => !candidate.isSynthetic).slice(0, 2);
    if (real.length === 0) return [];
    try {
      const searches = await Promise.all(real.map(async (candidate) => {
        const response = await this.fetcher("https://api.tavily.com/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ api_key: this.apiKey, query: `${candidate.name} ${candidate.cuisine} restaurant`, max_results: 1, search_depth: "basic" }),
          signal,
        });
        if (!response.ok) return [];
        const body = await response.json() as { results?: { title?: string; url?: string }[] };
        return (body.results ?? []).flatMap((result) => result.title && result.url ? [{ title: result.title, url: result.url }] : []);
      }));
      return searches.flat();
    } catch {
      return [];
    }
  }
}

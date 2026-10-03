import type { PlanningCandidate } from "./types";

type MossModule = typeof import("@moss-js/moss");

export class MossRanker {
  constructor(
    private readonly projectId: string,
    private readonly projectKey: string,
    private readonly loader: () => Promise<MossModule> = () => import("@moss-js/moss"),
    private readonly indexName = process.env.MOSS_INDEX_NAME ?? "bitequest-restaurants",
  ) {}

  async rank(candidates: PlanningCandidate[], preferences: string[]): Promise<PlanningCandidate[]> {
    if (preferences.length === 0) return candidates;
    try {
      const { MossClient } = await this.loader();
      const client = new MossClient(this.projectId, this.projectKey);
      try {
        await client.loadIndex(this.indexName);
        const result = await client.query(this.indexName, preferences.join(" "), { topK: candidates.length });
        const order = new Map(result.docs.map((document, index) => [document.id, index]));
        return [...candidates].sort((a, b) => (order.get(a.id) ?? candidates.length) - (order.get(b.id) ?? candidates.length));
      } finally {
        await client.close();
      }
    } catch {
      return candidates;
    }
  }
}

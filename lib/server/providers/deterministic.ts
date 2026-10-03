import { haversineMeters } from "../domain/geo";
import type { PlanningProvider } from "./types";

export const deterministicProvider: PlanningProvider = {
  name: "deterministic",
  async rank(candidates, input) {
    const preferences = new Set(input.preferences.map((value) => value.toLowerCase()));
    return [...candidates]
      .sort((a, b) => {
        const matches = (candidate: typeof a) => candidate.tags.filter((tag) => preferences.has(tag.toLowerCase())).length;
        return matches(b) - matches(a) || haversineMeters(input.location, a) - haversineMeters(input.location, b) || a.id.localeCompare(b.id);
      })
      .map((candidate) => ({ restaurantId: candidate.id, reason: "Best fit for your route, budget, and preferences" }));
  },
};

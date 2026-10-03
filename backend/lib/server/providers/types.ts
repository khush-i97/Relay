import type { AdventureRequest, Restaurant } from "../../../shared/contracts";

export interface PlanningCandidate extends Restaurant {
  discovered: boolean;
  rewardEligibleToday: boolean;
}

export interface RankedCandidate {
  restaurantId: string;
  reason: string;
}

export interface PlanningProvider {
  readonly name: "zoowork" | "novita" | "deterministic";
  rank(candidates: PlanningCandidate[], input: Required<AdventureRequest>, signal: AbortSignal): Promise<RankedCandidate[]>;
}

export async function withProviderTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parentSignal: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(parentSignal.reason);
  parentSignal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("Provider timed out")), timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted && !parentSignal.aborted) throw new Error("Provider timed out");
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal.removeEventListener("abort", onAbort);
  }
}

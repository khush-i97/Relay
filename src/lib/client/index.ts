import { createHttpApi } from "@/lib/client/http-api";
import type { BiteQuestApi } from "@/lib/client/types";
import { mockApi } from "@/lib/mock/api";

export type { BiteQuestApi } from "@/lib/client/types";

function apiMode(): "mock" | "live" {
  return import.meta.env.VITE_API_MODE === "live" ? "live" : "mock";
}

let liveApi: BiteQuestApi | null = null;

export function isMockMode(): boolean {
  return apiMode() === "mock";
}

export function getApi(): BiteQuestApi {
  if (apiMode() === "live") {
    liveApi ??= createHttpApi("/api/v1");
    return liveApi;
  }
  return mockApi;
}

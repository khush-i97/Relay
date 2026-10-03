import { deterministicProvider } from "./deterministic";
import { NovitaProvider } from "./novita";
import type { PlanningProvider } from "./types";
import { ZooWorkAgentProvider, ZooWorkProvider } from "./zoowork";

export function configuredPlanningProvider(): PlanningProvider {
  const selected = process.env.ADVENTURE_PROVIDER ?? "deterministic";
  if (selected === "novita") {
    return process.env.NOVITA_API_KEY && process.env.NOVITA_MODEL
      ? new NovitaProvider(process.env.NOVITA_API_KEY, process.env.NOVITA_MODEL)
      : unavailable("novita");
  }
  if (selected === "zoowork") {
    const paidKey = process.env.ZOODATA_API_KEY;
    const previewKey = process.env.ZOOWORK_API_KEY;
    return paidKey
      ? new ZooWorkProvider(paidKey, fetch, "https://api.zoodata.ai/v1/systemone")
      : previewKey
        ? new ZooWorkAgentProvider(previewKey)
        : unavailable("zoowork");
  }
  return deterministicProvider;
}

function unavailable(name: "zoowork" | "novita"): PlanningProvider {
  return { name, async rank() { throw new Error(`${name} is not configured`); } };
}

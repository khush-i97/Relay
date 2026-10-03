import { createServerFn } from "@tanstack/react-start";
import { walkingSeconds, type WalkRoute, type WalkStep } from "@/lib/walk";

type RouterStep = {
  distance?: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string };
};

function cleanName(name: string | undefined): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed || trimmed.toLowerCase() === "the walkway" || trimmed.toLowerCase() === "the crosswalk") return "";
  return trimmed;
}

function phrase(modifier: string | undefined): string {
  if (!modifier) return "";
  return modifier.replaceAll("_", " ");
}

function instructionFor(step: RouterStep, restaurantName: string): string {
  const type = step.maneuver?.type ?? "continue";
  const turn = phrase(step.maneuver?.modifier);
  const name = cleanName(step.name);
  const onStreet = name ? ` on ${name}` : "";
  const onto = name ? ` onto ${name}` : "";
  if (type === "arrive") return `Arrive at ${restaurantName}`;
  if (type === "depart") return turn ? `Head ${turn}${onStreet}` : `Start walking${onStreet}`;
  if (type === "turn" || type === "end of road" || type === "fork") {
    return `Turn ${turn || "ahead"}${onto}`;
  }
  if (type === "roundabout" || type === "rotary") return `Take the roundabout${onto}`;
  if (type === "new name" || type === "continue") return name ? `Continue on ${name}` : "Continue straight";
  return name ? `Continue on ${name}` : turn ? `Continue ${turn}` : "Continue straight";
}

function asRoute(payload: unknown, restaurantName: string): WalkRoute | null {
  if (!payload || typeof payload !== "object") return null;
  const code = "code" in payload ? payload.code : null;
  if (code !== "Ok") return null;
  const routes = "routes" in payload && Array.isArray(payload.routes) ? payload.routes : [];
  const route = routes[0];
  if (!route || typeof route !== "object") return null;
  const geometry = "geometry" in route ? route.geometry : null;
  const coordinates =
    geometry && typeof geometry === "object" && "coordinates" in geometry && Array.isArray(geometry.coordinates)
      ? geometry.coordinates.flatMap((pair: unknown) => {
          if (!Array.isArray(pair) || pair.length < 2 || typeof pair[0] !== "number" || typeof pair[1] !== "number") return [];
          if (!Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) return [];
          return [[pair[0], pair[1]] as [number, number]];
        })
      : [];
  if (coordinates.length < 2) return null;
  const legs = "legs" in route && Array.isArray(route.legs) ? route.legs : [];
  const rawSteps = legs[0] && typeof legs[0] === "object" && "steps" in legs[0] && Array.isArray(legs[0].steps) ? legs[0].steps : [];
  const steps: WalkStep[] = [];
  let along = 0;
  for (const raw of rawSteps) {
    if (!raw || typeof raw !== "object") continue;
    const step = raw as RouterStep;
    const distance = Number.isFinite(step.distance) ? Math.max(0, step.distance ?? 0) : 0;
    steps.push({
      instruction: instructionFor(step, restaurantName),
      distanceMeters: Math.round(distance),
      alongMeters: Math.round(along),
    });
    along += distance;
  }
  const distanceMeters = Math.round(
    "distance" in route && typeof route.distance === "number" && Number.isFinite(route.distance) ? route.distance : along,
  );
  if (steps.length === 0) {
    steps.push({
      instruction: `Walk to ${restaurantName}`,
      distanceMeters,
      alongMeters: 0,
    });
  }
  return {
    coordinates,
    distanceMeters,
    durationSeconds: walkingSeconds(distanceMeters),
    steps,
  };
}

async function ask(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return response.json();
}

export const fetchWalk = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Bad coordinates");
    const raw = input as Record<string, unknown>;
    const values = [raw.fromLat, raw.fromLng, raw.toLat, raw.toLng];
    if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) throw new Error("Bad coordinates");
    const [fromLat, fromLng, toLat, toLng] = values as number[];
    if (fromLat < -90 || fromLat > 90 || toLat < -90 || toLat > 90 || fromLng < -180 || fromLng > 180 || toLng < -180 || toLng > 180) {
      throw new Error("Bad coordinates");
    }
    const restaurantName = typeof raw.restaurantName === "string" && raw.restaurantName.trim() ? raw.restaurantName.trim().slice(0, 80) : "the restaurant";
    return { fromLat, fromLng, toLat, toLng, restaurantName };
  })
  .handler(async ({ data }): Promise<WalkRoute> => {
    const path = `${data.fromLng},${data.fromLat};${data.toLng},${data.toLat}`;
    const urls = [
      `https://router.project-osrm.org/route/v1/walking/${path}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${path}?overview=full&geometries=geojson&steps=true`,
    ];
    for (const url of urls) {
      try {
        const route = asRoute(await ask(url), data.restaurantName);
        if (route) return route;
      } catch {
        // Try the next router.
      }
    }
    throw new Error("Couldn't find streets for that walk.");
  });

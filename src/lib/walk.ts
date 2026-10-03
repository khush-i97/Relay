import type { Coordinates } from "@/lib/contracts";
import { haversine } from "@/lib/geo";

export type WalkStep = {
  instruction: string;
  distanceMeters: number;
  alongMeters: number;
};

export type WalkRoute = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  steps: WalkStep[];
};

type Segment = {
  a: [number, number];
  b: [number, number];
  start: number;
  length: number;
  bearing: number;
};

export type MeasuredPath = {
  total: number;
  segments: Segment[];
};

const WALK_MPS = 1.35;

export function walkingSeconds(distanceMeters: number): number {
  return Math.max(60, Math.round(distanceMeters / WALK_MPS));
}

export function walkOrigin(location: Coordinates | null, destination: Coordinates): Coordinates {
  if (location) {
    const distance = haversine(location, destination);
    if (distance >= 40 && distance <= 1800) return location;
  }
  return {
    latitude: destination.latitude - 0.0044,
    longitude: destination.longitude - 0.0052,
  };
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function bearingBetween(a: [number, number], b: [number, number]): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLng = toRad(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function measurePath(coordinates: [number, number][]): MeasuredPath {
  const segments: Segment[] = [];
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const a = coordinates[index - 1];
    const b = coordinates[index];
    const length = haversine({ longitude: a[0], latitude: a[1] }, { longitude: b[0], latitude: b[1] });
    if (length < 0.5) continue;
    segments.push({ a, b, start: total, length, bearing: bearingBetween(a, b) });
    total += length;
  }
  return { total, segments };
}

export function pointAlong(path: MeasuredPath, meters: number): { longitude: number; latitude: number; bearing: number } {
  const last = path.segments[path.segments.length - 1];
  if (!last) return { longitude: 0, latitude: 0, bearing: 0 };
  const traveled = Math.max(0, Math.min(path.total, meters));
  const segment = path.segments.find((item) => traveled <= item.start + item.length) ?? last;
  const t = segment.length === 0 ? 1 : (traveled - segment.start) / segment.length;
  const clamped = Math.max(0, Math.min(1, t));
  return {
    longitude: segment.a[0] + (segment.b[0] - segment.a[0]) * clamped,
    latitude: segment.a[1] + (segment.b[1] - segment.a[1]) * clamped,
    bearing: segment.bearing,
  };
}

export function stepIndexAt(steps: WalkStep[], traveledMeters: number): number {
  let index = 0;
  for (let cursor = 0; cursor < steps.length; cursor += 1) {
    if (steps[cursor].alongMeters <= traveledMeters + 2) index = cursor;
  }
  return index;
}

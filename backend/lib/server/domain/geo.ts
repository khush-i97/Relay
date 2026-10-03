import type { Point } from "../../../shared/contracts";

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineMeters(a: Point, b: Point): number {
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

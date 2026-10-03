import { useEffect, useMemo, useRef, useState } from "react";
import MapGL, { AttributionControl, Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import { Marker as MapLibreMarker, setWorkerUrl, type LightSpecification, type Map as MapLibreMap, type SkySpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Check, LocateFixed, Minus, Navigation, Plus } from "lucide-react";
import { CuisineIcon } from "@/components/restaurants/cuisine";
import { RARITY_META } from "@/components/restaurants/rarity";
import type { AdventurePlan, LocationFix, NearbyRestaurant } from "@/lib/contracts";
import { INITIAL_CAMERA } from "@/lib/rules";
import { measurePath, pointAlong, stepIndexAt, type WalkRoute } from "@/lib/walk";
import { cn } from "@/lib/utils";
import { useUi, type Camera } from "@/stores/ui";

setWorkerUrl(workerUrl);

const CITY_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const POI_LAYERS = ["poi_r20", "poi_r7", "poi_r1", "poi_transit"];

const LAND = "#e6efd2";
const PARK = "#78c86a";
const WOOD = "#62b85c";
const WATER = "#59b4e6";
const ROAD = "#fffdf8";
const CASING = "#d5ccb2";
const BUILDING = "#f6f0e4";

const SKY: SkySpecification = {
  "sky-color": "#b7d4f2",
  "horizon-color": "#e6efd2",
  "fog-color": "#e6efd2",
  "sky-horizon-blend": 0.8,
  "horizon-fog-blend": 0.4,
  "fog-ground-blend": 0.05,
  "atmosphere-blend": 0.12,
};

const LIGHT: LightSpecification = {
  anchor: "viewport",
  color: "#fff8ee",
  intensity: 0.45,
  position: [1.2, 200, 35],
};

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Props = {
  restaurants: NearbyRestaurant[];
  plan: AdventurePlan | null;
  location: LocationFix | null;
  onLocate: () => void;
  locating: boolean;
  onSearchArea: () => void;
  areaDirty: boolean;
  panelOpen: boolean;
  walkRoute: WalkRoute | null;
  onWalkProgress: (stepIndex: number, remainingMeters: number) => void;
  onWalkArrive: () => void;
};

function roadWidth(id: string) {
  if (id.includes("motorway") || id.includes("trunk_primary")) {
    return ["interpolate", ["linear"], ["zoom"], 12, 1.6, 14, 4.5, 16, 12, 18, 26];
  }
  if (id.includes("secondary") || id.includes("tertiary") || id.includes("street")) {
    return ["interpolate", ["linear"], ["zoom"], 12, 1.1, 14, 3.2, 16, 8, 18, 18];
  }
  if (id.includes("path") || id.includes("pedestrian") || id.includes("service") || id.includes("track")) {
    return ["interpolate", ["linear"], ["zoom"], 13, 0.4, 15, 1.6, 17, 4, 18, 8];
  }
  return ["interpolate", ["linear"], ["zoom"], 12, 0.7, 14, 2.2, 16, 6, 18, 14];
}

function dressCity(map: MapLibreMap) {
  if (map.getLayer("background")) map.setPaintProperty("background", "background-color", LAND);
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    if (id === "water" || id.startsWith("waterway")) {
      const prop = layer.type === "line" ? "line-color" : "fill-color";
      map.setPaintProperty(id, prop, WATER);
    } else if (id === "park" || id === "landcover_grass" || id === "landuse_pitch") {
      map.setPaintProperty(id, "fill-color", PARK);
    } else if (id === "landcover_wood") {
      map.setPaintProperty(id, "fill-color", WOOD);
    } else if (id === "landuse_residential" || id === "landuse_school" || id === "landuse_hospital") {
      map.setPaintProperty(id, "fill-color", "#efe6c4");
    } else if (id.includes("rail")) {
      map.setLayoutProperty(id, "visibility", "none");
    } else if (layer.type === "line" && (id.startsWith("road_") || id.startsWith("bridge_") || id.startsWith("tunnel_"))) {
      map.setPaintProperty(id, "line-color", id.includes("casing") ? CASING : ROAD);
      map.setPaintProperty(id, "line-width", roadWidth(id) as never);
    }
  }
  map.setSky(SKY);
  map.setLight(LIGHT);
  for (const id of POI_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
  }
  if (map.getLayer("building-3d")) {
    map.setPaintProperty("building-3d", "fill-extrusion-color", BUILDING);
    map.setPaintProperty("building-3d", "fill-extrusion-opacity", 0.94);
    map.setPaintProperty("building-3d", "fill-extrusion-height", ["*", ["coalesce", ["get", "render_height"], 8], 0.72]);
  }
}

function paddingForPanel() {
  const width = window.innerWidth;
  if (width >= 1024) return { top: 130, right: 420, bottom: 48, left: 120 };
  if (width >= 768) return { top: 130, right: 40, bottom: 96, left: 460 };
  return { top: 150, right: 28, bottom: Math.round(window.innerHeight * 0.42), left: 28 };
}

export function ExploreMap({
  restaurants,
  plan,
  location,
  onLocate,
  locating,
  onSearchArea,
  areaDirty,
  panelOpen,
  walkRoute,
  onWalkProgress,
  onWalkArrive,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const snapshot = useRef<Camera | null>(null);
  const needleRef = useRef<HTMLSpanElement>(null);
  const tiltLabelRef = useRef<HTMLSpanElement>(null);
  const tiltBtnRef = useRef<HTMLButtonElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const progressRef = useRef(onWalkProgress);
  const arriveRef = useRef(onWalkArrive);
  progressRef.current = onWalkProgress;
  arriveRef.current = onWalkArrive;
  const selected = useUi((state) => state.selected);
  const fly = useUi((state) => state.fly);
  const setCamera = useUi((state) => state.setCamera);
  const select = useUi((state) => state.select);
  const stopOrder = useMemo(() => {
    const orders = new Map<string, number>();
    plan?.stops.forEach((stop) => orders.set(stop.restaurantId, stop.order));
    return orders;
  }, [plan]);

  const routeData = useMemo(() => {
    if (!plan || plan.route.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: plan.route },
    };
  }, [plan]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fly) return;
    map.easeTo({
      center: [fly.camera.longitude, fly.camera.latitude],
      zoom: fly.camera.zoom,
      pitch: fly.camera.pitch,
      bearing: fly.camera.bearing,
      duration: reducedMotion() ? 0 : 700,
      essential: true,
    });
  }, [fly]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || walkRoute) return;
    if (selected) {
      if (!snapshot.current) {
        const center = map.getCenter();
        snapshot.current = {
          longitude: center.lng,
          latitude: center.lat,
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        };
      }
      map.easeTo({
        center: [selected.longitude, selected.latitude],
        padding: paddingForPanel(),
        duration: reducedMotion() ? 0 : 650,
        essential: true,
      });
      return;
    }
    if (snapshot.current) {
      const previous = snapshot.current;
      snapshot.current = null;
      map.easeTo({
        center: [previous.longitude, previous.latitude],
        zoom: previous.zoom,
        bearing: previous.bearing,
        pitch: previous.pitch,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        duration: reducedMotion() ? 0 : 500,
      });
    }
  }, [selected, walkRoute]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapReady || !walkRoute) return;
    const path = measurePath(walkRoute.coordinates);
    if (path.segments.length === 0) return;

    const element = document.createElement("div");
    element.className = "walker";
    element.innerHTML =
      '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#f6f1e8" stroke="#2f6b4f" stroke-width="3"/><path d="M24 9l9.5 20h-6.2V39h-6.6V29H14.5z" fill="#2f6b4f"/></svg>';
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "You, walking the route");
    const start = pointAlong(path, 0);
    const marker = new MapLibreMarker({ element, anchor: "center", rotationAlignment: "map", pitchAlignment: "map" })
      .setLngLat([start.longitude, start.latitude])
      .setRotation(start.bearing)
      .addTo(map);

    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const [lng, lat] of walkRoute.coordinates) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: window.innerWidth < 768 ? { top: 150, right: 48, bottom: 180, left: 36 } : { top: 120, right: 80, bottom: 140, left: 80 }, pitch: 48, duration: reducedMotion() ? 0 : 700 },
    );

    const playMs = reducedMotion() ? 1600 : Math.min(24000, Math.max(14000, path.total * 16));
    let frame = 0;
    let startedAt = 0;
    let lastCamera = 0;
    let lastProgress = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / playMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const traveled = path.total * eased;
      const point = pointAlong(path, traveled);
      marker.setLngLat([point.longitude, point.latitude]).setRotation(point.bearing);
      if (now - lastProgress > 400) {
        lastProgress = now;
        progressRef.current(stepIndexAt(walkRoute.steps, traveled), Math.max(0, path.total - traveled));
      }
      if (now - lastCamera > 450) {
        lastCamera = now;
        map.easeTo({
          center: [point.longitude, point.latitude],
          bearing: point.bearing,
          pitch: 50,
          zoom: 16.6,
          duration: reducedMotion() ? 0 : 500,
          essential: true,
        });
      }
      if (t < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const end = pointAlong(path, path.total);
      marker.setLngLat([end.longitude, end.latitude]).setRotation(end.bearing);
      progressRef.current(walkRoute.steps.length - 1, 0);
      arriveRef.current();
    };
    const timer = window.setTimeout(() => {
      startedAt = performance.now();
      frame = requestAnimationFrame(tick);
    }, reducedMotion() ? 0 : 800);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      marker.remove();
    };
  }, [mapReady, walkRoute]);

  function paintChrome(bearing: number, pitch: number) {
    if (needleRef.current) needleRef.current.style.transform = `rotate(${-bearing}deg)`;
    const tilted = pitch > 8;
    if (tiltLabelRef.current && tiltLabelRef.current.textContent !== (tilted ? "2D" : "3D")) {
      tiltLabelRef.current.textContent = tilted ? "2D" : "3D";
    }
    tiltBtnRef.current?.setAttribute("aria-label", tilted ? "Switch to a flat map" : "Tilt the map into 3D");
  }

  function tiltMap() {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const tilted = map.getPitch() > 8;
    map.easeTo({
      pitch: tilted ? 0 : 50,
      bearing: tilted ? 0 : map.getBearing(),
      duration: reducedMotion() ? 0 : 650,
      essential: true,
    });
  }

  function faceNorth() {
    mapRef.current?.getMap()?.easeTo({
      bearing: 0,
      duration: reducedMotion() ? 0 : 500,
      essential: true,
    });
  }

  return (
    <div className="explore-map relative h-full w-full bg-map">
      <MapGL
        ref={mapRef}
        mapStyle={CITY_STYLE}
        initialViewState={useUi.getState().camera}
        minZoom={11}
        maxZoom={18}
        minPitch={0}
        maxPitch={68}
        maxBounds={[-122.55, 37.68, -122.34, 37.86]}
        dragRotate
        pitchWithRotate
        touchPitch
        renderWorldCopies={false}
        attributionControl={false}
        sky={SKY}
        light={LIGHT}
        onLoad={(event) => {
          dressCity(event.target);
          const view = useUi.getState().camera;
          if (view.zoom < 14.4) {
            event.target.easeTo({
              center: [INITIAL_CAMERA.longitude, INITIAL_CAMERA.latitude],
              zoom: INITIAL_CAMERA.zoom,
              pitch: INITIAL_CAMERA.pitch,
              bearing: INITIAL_CAMERA.bearing,
              duration: reducedMotion() ? 0 : 800,
              essential: true,
            });
          }
          paintChrome(event.target.getBearing(), event.target.getPitch());
          setMapReady(true);
        }}
        onMove={(event) => {
          paintChrome(event.viewState.bearing, event.viewState.pitch);
        }}
        onClick={() => {
          if (!walkRoute) select(null);
        }}
        onMoveEnd={(event) => {
          const view = event.viewState;
          setCamera({
            latitude: view.latitude,
            longitude: view.longitude,
            zoom: view.zoom,
            pitch: view.pitch,
            bearing: view.bearing,
          });
        }}
      >
        <AttributionControl customAttribution="Relay · OpenFreeMap · OpenStreetMap" position="bottom-left" />
        {routeData ? (
          <Source id="adventure-route" type="geojson" data={routeData}>
            <Layer
              id="adventure-route-line"
              type="line"
              paint={{
                "line-color": "#9e2a22",
                "line-width": 4,
                "line-dasharray": [1.2, 1.1],
              }}
            />
          </Source>
        ) : null}
        {walkRoute ? (
          <Source
            id="walk-route"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: walkRoute.coordinates },
            }}
          >
            <Layer
              id="walk-route-line"
              type="line"
              paint={{
                "line-color": "#2f6b4f",
                "line-width": 6,
                "line-opacity": 0.95,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>
        ) : null}
        {location && !walkRoute ? (
          <Marker longitude={location.longitude} latitude={location.latitude} anchor="center">
            <span
              className={cn(
                "block size-4 rounded-full border-2 border-paper",
                location.simulated ? "bg-gold-deep" : "bg-olive",
              )}
              title={location.simulated ? "Simulated location" : "Your location"}
            />
          </Marker>
        ) : null}
        {restaurants.map((restaurant) => {
          const meta = RARITY_META[restaurant.rarity];
          const Glyph = meta.icon;
          const active = selected?.id === restaurant.id;
          const order = stopOrder.get(restaurant.id);
          return (
            <Marker
              key={restaurant.id}
              longitude={restaurant.coordinates.longitude}
              latitude={restaurant.coordinates.latitude}
              anchor="center"
              style={{ zIndex: active ? 5 : 1 }}
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                select({
                  id: restaurant.id,
                  latitude: restaurant.coordinates.latitude,
                  longitude: restaurant.coordinates.longitude,
                });
              }}
            >
              <button
                type="button"
                className="relative flex size-11 items-center justify-center"
                aria-pressed={active}
                aria-label={`${restaurant.name}, ${meta.label}${restaurant.collected ? ", collected" : ", undiscovered"}`}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full bg-paper text-ink ring-2",
                    meta.ring,
                    active && "scale-110 ring-4",
                  )}
                >
                  <CuisineIcon cuisine={restaurant.cuisine} className="size-4" />
                </span>
                <Glyph className={cn("absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-paper", meta.glyph)} />
                {restaurant.collected ? (
                  <Check className="absolute -left-0.5 -top-0.5 size-3.5 rounded-full bg-olive p-0.5 text-paper" />
                ) : null}
                {order ? (
                  <span className="absolute -right-1 -top-2 flex size-5 items-center justify-center rounded-full bg-chili-deep text-xs font-semibold text-paper">
                    {order}
                  </span>
                ) : null}
              </button>
            </Marker>
          );
        })}
      </MapGL>
      {!panelOpen && areaDirty ? (
        <button type="button" className="search-area-chip min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper" onClick={onSearchArea}>
          Search this area
        </button>
      ) : null}
      <div className={cn("map-tools", panelOpen && "max-md:hidden")}>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-paper text-ink shadow-panel"
          aria-label="Face north"
          onClick={faceNorth}
        >
          <span ref={needleRef} className="inline-flex" style={{ transform: "rotate(18deg)" }}>
            <Navigation className="size-5 fill-chili text-chili-deep" />
          </span>
        </button>
        <button
          ref={tiltBtnRef}
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-paper text-sm font-semibold text-ink shadow-panel"
          aria-label="Switch to a flat map"
          onClick={tiltMap}
        >
          <span ref={tiltLabelRef}>2D</span>
        </button>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-paper text-ink shadow-panel" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus className="size-5" />
        </button>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-paper text-ink shadow-panel" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus className="size-5" />
        </button>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-paper text-ink shadow-panel" aria-label="Use my location" onClick={onLocate} disabled={locating}>
          <LocateFixed className={cn("size-5", locating && "animate-pulse")} />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Navigation, Route } from "lucide-react";
import { AdventureSheet } from "@/components/adventure/adventure-sheet";
import { MapSlot } from "@/components/map/map-slot";
import { Celebration } from "@/components/restaurants/celebration";
import { CheckInSheet } from "@/components/restaurants/check-in-sheet";
import { RestaurantPanel } from "@/components/restaurants/restaurant-panel";
import { HeaderBar } from "@/components/shell/header-bar";
import { Button } from "@/components/ui/button";
import { RedeemSheet } from "@/components/wallet/redeem-sheet";
import { useApplySummary, useCatalog, useNearby, useRefreshLedger } from "@/hooks/queries";
import type { VisitResponse } from "@/lib/contracts";
import { cuisineOptions } from "@/lib/cuisines";
import { haversine } from "@/lib/geo";
import { captureBrowserLocation } from "@/lib/location";
import { formatDistance } from "@/lib/format";
import { INITIAL_CAMERA } from "@/lib/rules";
import { walkOrigin, type WalkRoute } from "@/lib/walk";
import { fetchWalk } from "@/lib/walk.functions";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";

type WalkSession = {
  restaurantId: string;
  restaurantName: string;
  status: "loading" | "playing" | "arrived" | "error";
  route: WalkRoute | null;
  stepIndex: number;
  remainingMeters: number;
  message: string | null;
};

export function ExploreScreen() {
  const nearby = useNearby();
  const catalog = useCatalog();
  const apply = useApplySummary();
  const refresh = useRefreshLedger();
  const selected = useUi((state) => state.selected);
  const cuisine = useUi((state) => state.cuisine);
  const setCuisine = useUi((state) => state.setCuisine);
  const camera = useUi((state) => state.camera);
  const searchCenter = useUi((state) => state.searchCenter);
  const setSearchCenter = useUi((state) => state.setSearchCenter);
  const browseMode = useUi((state) => state.browseMode);
  const location = useUi((state) => state.location);
  const setLocation = useUi((state) => state.setLocation);
  const overlay = useUi((state) => state.overlay);
  const setOverlay = useUi((state) => state.setOverlay);
  const plan = useUi((state) => state.plan);
  const setPlan = useUi((state) => state.setPlan);
  const select = useUi((state) => state.select);
  const requestFly = useUi((state) => state.requestFly);
  const setBrowseMode = useUi((state) => state.setBrowseMode);
  const returnToDemo = useUi((state) => state.returnToDemo);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [walk, setWalk] = useState<WalkSession | null>(null);

  const restaurants = nearby.data?.restaurants ?? [];
  const visible = useMemo(
    () => restaurants.filter((restaurant) => !cuisine || restaurant.cuisine === cuisine),
    [restaurants, cuisine],
  );
  const restaurant =
    restaurants.find((item) => item.id === selected?.id) ??
    catalog.data?.restaurants.find((item) => item.id === selected?.id) ??
    null;
  const loadingVenue = Boolean(selected) && !restaurant && (nearby.isLoading || catalog.isLoading);
  const missingVenue = Boolean(selected) && !restaurant && !nearby.isLoading && !catalog.isLoading && !nearby.isFetching;
  const areaDirty = haversine(camera, searchCenter) > 220;
  const celebrate = overlay?.type === "celebrate" ? overlay.result : null;
  const celebrateRestaurant =
    restaurants.find((item) => item.id === celebrate?.restaurantId) ??
    catalog.data?.restaurants.find((item) => item.id === celebrate?.restaurantId) ??
    null;
  const showingVenue = Boolean(selected) && walk?.status !== "playing" && walk?.status !== "arrived";

  useEffect(() => {
    if (!walk) return;
    if (!selected || selected.id !== walk.restaurantId) setWalk(null);
  }, [selected, walk]);

  async function locate() {
    setLocating(true);
    setLocateError(null);
    try {
      const fix = await captureBrowserLocation();
      setLocation(fix);
      setBrowseMode("gps");
      setSearchCenter({ latitude: fix.latitude, longitude: fix.longitude });
      requestFly({ ...INITIAL_CAMERA, latitude: fix.latitude, longitude: fix.longitude, zoom: 15.6 });
    } catch (error) {
      setLocateError(error instanceof Error ? error.message : "Couldn't read your location.");
    } finally {
      setLocating(false);
    }
  }

  function onVisit(result: VisitResponse) {
    setOverlay({ type: "celebrate", result });
  }

  async function beginWalk() {
    if (!restaurant) return;
    const origin = walkOrigin(location, restaurant.coordinates);
    if (location && haversine(location, restaurant.coordinates) < 40) {
      setWalk({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        status: "arrived",
        route: null,
        stepIndex: 0,
        remainingMeters: 0,
        message: null,
      });
      return;
    }
    setWalk({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      status: "loading",
      route: null,
      stepIndex: 0,
      remainingMeters: 0,
      message: null,
    });
    try {
      const route = await fetchWalk({
        data: {
          fromLat: origin.latitude,
          fromLng: origin.longitude,
          toLat: restaurant.coordinates.latitude,
          toLng: restaurant.coordinates.longitude,
          restaurantName: restaurant.name,
        },
      });
      setWalk({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        status: "playing",
        route,
        stepIndex: 0,
        remainingMeters: route.distanceMeters,
        message: null,
      });
    } catch (error) {
      setWalk({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        status: "error",
        route: null,
        stepIndex: 0,
        remainingMeters: 0,
        message: error instanceof Error ? error.message : "Couldn't find streets for that walk.",
      });
    }
  }

  return (
    <div className="relative h-full">
      <MapSlot
        restaurants={visible}
        plan={plan}
        location={location}
        locating={locating}
        areaDirty={areaDirty}
        panelOpen={Boolean(selected)}
        walkRoute={walk && (walk.status === "playing" || walk.status === "arrived") ? walk.route : null}
        onWalkProgress={(stepIndex, remainingMeters) => {
          setWalk((current) => (current && current.status === "playing" ? { ...current, stepIndex, remainingMeters } : current));
        }}
        onWalkArrive={() => {
          setWalk((current) => (current && current.status === "playing" ? { ...current, status: "arrived", remainingMeters: 0 } : current));
        }}
        onLocate={() => void locate()}
        onSearchArea={() => setSearchCenter({ latitude: camera.latitude, longitude: camera.longitude })}
      />
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="pointer-events-auto">
          <HeaderBar />
          <div className="chip-row flex gap-2 overflow-x-auto px-3 py-2">
            <span className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-olive px-3 text-xs font-semibold text-paper">
              {browseMode === "gps" ? "Using your GPS" : "SF demo · not verified GPS"}
            </span>
            <FilterChip active={cuisine === null} onClick={() => setCuisine(null)}>
              All
            </FilterChip>
            {cuisineOptions(restaurants, cuisine).map((item) => (
              <FilterChip key={item} active={cuisine === item} onClick={() => setCuisine(item)}>
                {item}
              </FilterChip>
            ))}
          </div>
          {locateError ? <p className="px-3 pb-1 text-xs text-chili-deep">{locateError}</p> : null}
        </div>
      </div>
      {nearby.isError ? (
        <div className="absolute left-1/2 top-40 z-20 w-72 -translate-x-1/2 rounded-3xl bg-paper p-4 text-center shadow-panel">
          <p className="text-sm">Couldn't load restaurants.</p>
          <Button className="mt-3" variant="secondary" onClick={() => void nearby.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}
      {nearby.data && visible.length === 0 ? (
        <div className="absolute left-1/2 top-44 z-20 w-72 -translate-x-1/2 rounded-3xl bg-paper p-4 text-center shadow-panel">
          <p className="text-sm">{cuisine ? `No ${cuisine} spots in this area.` : "No Relay venues in this area."}</p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => {
              if (cuisine) setCuisine(null);
              else returnToDemo();
            }}
          >
            {cuisine ? "Reset filters" : "Back to SF demo"}
          </Button>
        </div>
      ) : null}
      {!selected ? (
        <button type="button" className="adventure-fab inline-flex min-h-11 items-center gap-2 rounded-full bg-chili-deep px-4 text-sm font-semibold text-paper shadow-panel" onClick={() => setOverlay({ type: "adventure" })}>
          <Route className="size-4" aria-hidden />
          Adventure
        </button>
      ) : null}
      {plan && !selected && !walk ? (
        <div className="route-chip flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 shadow-panel">
          <button type="button" className="min-h-11 text-left text-sm" onClick={() => setOverlay({ type: "adventure" })}>
            {plan.stops.length} stops · Approximate walking route
          </button>
          <button type="button" className="min-h-11 text-sm text-muted" onClick={() => setPlan(null)}>
            Clear
          </button>
        </div>
      ) : null}
      {showingVenue ? (
        <RestaurantPanel
          restaurant={restaurant}
          loading={loadingVenue}
          missing={missingVenue}
          onClose={() => select(null)}
          onCheckIn={() => restaurant && setOverlay({ type: "checkin", restaurantId: restaurant.id })}
          onRedeem={() => restaurant && setOverlay({ type: "redeem", restaurantId: restaurant.id })}
          onWalk={() => void beginWalk()}
          walking={walk?.status === "loading"}
          walkError={walk?.status === "error" ? walk.message : null}
          onBackToDemo={returnToDemo}
        />
      ) : null}
      {walk && (walk.status === "playing" || walk.status === "arrived") ? (
        <div className="walk-banner rounded-3xl border border-line bg-paper p-3 shadow-panel" role="status">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-olive text-paper">
              <Navigation className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {walk.status === "arrived"
                  ? `You're outside ${walk.restaurantName}`
                  : (walk.route?.steps[walk.stepIndex]?.instruction ?? `Walking to ${walk.restaurantName}`)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {walk.status === "arrived"
                  ? "Demo walk finished."
                  : `${formatDistance(walk.remainingMeters)} left · ${Math.max(1, Math.round((walk.route?.durationSeconds ?? 60) / 60))} min on foot · sped up so you can watch`}
              </p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            {walk.status === "arrived" ? (
              <Button className="flex-1" variant="olive" onClick={() => setWalk(null)}>
                View menu
              </Button>
            ) : (
              <Button className="flex-1" variant="secondary" onClick={() => setWalk(null)}>
                Stop
              </Button>
            )}
          </div>
        </div>
      ) : null}
      <CheckInSheet
        open={overlay?.type === "checkin"}
        restaurant={overlay?.type === "checkin" ? restaurant : null}
        location={location}
        onLocation={setLocation}
        onClose={() => setOverlay(null)}
        onSuccess={onVisit}
      />
      <Celebration
        result={celebrate}
        restaurant={celebrateRestaurant}
        onCommit={(result) => {
          apply(result.summary);
          refresh();
        }}
        onDone={() => setOverlay(null)}
      />
      <RedeemSheet
        open={overlay?.type === "redeem"}
        restaurantId={overlay?.type === "redeem" ? overlay.restaurantId : null}
        onOpenChange={(next) => {
          if (!next) setOverlay(null);
        }}
        onSuccess={(result) => {
          apply(result.summary);
          refresh();
        }}
      />
      <AdventureSheet
        open={overlay?.type === "adventure"}
        origin={location ?? searchCenter}
        onOpenChange={(next) => {
          if (!next) setOverlay(null);
        }}
        onPlan={setPlan}
        onStart={(nextPlan) => {
          const first = nextPlan.stops[0];
          if (!first) return;
          setPlan(nextPlan);
          select({
            id: first.restaurantId,
            latitude: first.coordinates.latitude,
            longitude: first.coordinates.longitude,
          });
          setOverlay(null);
        }}
      />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      className={cn("min-h-11 shrink-0 rounded-full px-3 text-sm", active ? "bg-ink text-paper" : "border border-line bg-paper text-ink")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

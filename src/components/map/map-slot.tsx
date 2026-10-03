import { useEffect, useState, type ComponentType } from "react";
import type { AdventurePlan, LocationFix, NearbyRestaurant } from "@/lib/contracts";
import type { WalkRoute } from "@/lib/walk";

export type MapSlotProps = {
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

export function MapSlot(props: MapSlotProps) {
  const [View, setView] = useState<ComponentType<MapSlotProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    import("./explore-map")
      .then((mod) => {
        if (live) setView(() => mod.ExploreMap);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center bg-map px-6 text-center text-sm text-muted">
        The demo map couldn't start. Reload to try again.
      </div>
    );
  }
  if (!View) return <div className="h-full w-full bg-map" />;
  return <View {...props} />;
}

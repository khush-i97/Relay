import type { AdventurePlan, LocationFix, VisitResponse } from "@/lib/contracts";
import { INITIAL_CAMERA, SF_CENTER } from "@/lib/rules";
import { create } from "zustand";

export type Camera = {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

export type Selection = {
  id: string;
  latitude: number;
  longitude: number;
};

export type Overlay =
  | { type: "checkin"; restaurantId: string }
  | { type: "celebrate"; result: VisitResponse }
  | { type: "adventure" }
  | { type: "redeem"; restaurantId: string }
  | null;

type UiState = {
  selected: Selection | null;
  camera: Camera;
  searchCenter: { latitude: number; longitude: number };
  browseMode: "demo" | "gps";
  location: LocationFix | null;
  overlay: Overlay;
  plan: AdventurePlan | null;
  celebratedVisitIds: string[];
  fly: { nonce: number; camera: Camera } | null;
  cuisine: string | null;
  select: (pick: Selection | null) => void;
  setCamera: (camera: Camera) => void;
  setSearchCenter: (center: { latitude: number; longitude: number }) => void;
  setBrowseMode: (mode: "demo" | "gps") => void;
  setLocation: (location: LocationFix | null) => void;
  setOverlay: (overlay: Overlay) => void;
  setPlan: (plan: AdventurePlan | null) => void;
  markCelebrated: (visitId: string) => void;
  requestFly: (camera: Camera) => void;
  setCuisine: (cuisine: string | null) => void;
  returnToDemo: () => void;
};

export const useUi = create<UiState>((set) => ({
  selected: null,
  camera: INITIAL_CAMERA,
  searchCenter: SF_CENTER,
  browseMode: "demo",
  location: null,
  overlay: null,
  plan: null,
  celebratedVisitIds: [],
  fly: null,
  cuisine: null,
  select: (pick) => set({ selected: pick }),
  setCamera: (camera) => set({ camera }),
  setSearchCenter: (searchCenter) => set({ searchCenter }),
  setBrowseMode: (browseMode) => set({ browseMode }),
  setLocation: (location) => set({ location }),
  setOverlay: (overlay) => set({ overlay }),
  setPlan: (plan) => set({ plan }),
  markCelebrated: (visitId) =>
    set((current) => ({
      celebratedVisitIds: current.celebratedVisitIds.includes(visitId)
        ? current.celebratedVisitIds
        : [...current.celebratedVisitIds, visitId],
    })),
  requestFly: (camera) => set((current) => ({ fly: { nonce: (current.fly?.nonce ?? 0) + 1, camera } })),
  setCuisine: (cuisine) => set({ cuisine }),
  returnToDemo: () =>
    set({
      searchCenter: SF_CENTER,
      browseMode: "demo",
      selected: null,
      camera: INITIAL_CAMERA,
      fly: { nonce: Date.now(), camera: INITIAL_CAMERA },
    }),
}));

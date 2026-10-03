import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/client";
import type { Summary } from "@/lib/contracts";
import { useClientReady } from "@/hooks/use-client-ready";
import { NEARBY_RADIUS_M, SF_CENTER } from "@/lib/rules";
import { useUi } from "@/stores/ui";

function round5(value: number) {
  return Math.round(value * 1e5) / 1e5;
}

export function useSession() {
  const ready = useClientReady();
  return useQuery({
    queryKey: ["session"],
    enabled: ready,
    queryFn: () => getApi().ensureSession(),
    staleTime: Infinity,
  });
}

export function useSummary() {
  const session = useSession();
  return useQuery({
    queryKey: ["summary", session.data?.sessionId],
    enabled: Boolean(session.data),
    queryFn: () => getApi().getSummary(),
  });
}

export function useNearby() {
  const session = useSession();
  const center = useUi((state) => state.searchCenter);
  return useQuery({
    queryKey: ["nearby", session.data?.sessionId, round5(center.latitude), round5(center.longitude), NEARBY_RADIUS_M],
    enabled: Boolean(session.data),
    queryFn: () =>
      getApi().getNearby({
        latitude: center.latitude,
        longitude: center.longitude,
        radiusMeters: NEARBY_RADIUS_M,
      }),
  });
}

export function useCatalog() {
  const session = useSession();
  return useQuery({
    queryKey: ["catalog", session.data?.sessionId],
    enabled: Boolean(session.data),
    queryFn: () => getApi().getNearby({ ...SF_CENTER, radiusMeters: NEARBY_RADIUS_M }),
  });
}

export function useCollection() {
  const session = useSession();
  return useQuery({
    queryKey: ["collection", session.data?.sessionId],
    enabled: Boolean(session.data),
    queryFn: () => getApi().getCollection(),
  });
}

export function useWallet() {
  const session = useSession();
  return useQuery({
    queryKey: ["wallet", session.data?.sessionId],
    enabled: Boolean(session.data),
    queryFn: () => getApi().getWallet(),
  });
}

export function useApplySummary() {
  const client = useQueryClient();
  const session = useSession();
  return (summary: Summary) => {
    client.setQueryData(["summary", session.data?.sessionId ?? summary.sessionId], summary);
  };
}

export function useRefreshLedger() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["nearby"] });
    void client.invalidateQueries({ queryKey: ["catalog"] });
    void client.invalidateQueries({ queryKey: ["collection"] });
    void client.invalidateQueries({ queryKey: ["wallet"] });
  };
}

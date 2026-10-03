import { createFileRoute } from "@tanstack/react-router";
import { ExploreScreen } from "@/components/explore/explore-screen";
import { AppShell } from "@/components/shell/app-shell";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <AppShell variant="map">
      <ExploreScreen />
    </AppShell>
  );
}

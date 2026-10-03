import { createFileRoute } from "@tanstack/react-router";
import { CollectionView } from "@/components/collection/collection-view";
import { AppShell } from "@/components/shell/app-shell";

export const Route = createFileRoute("/collection")({
  component: CollectionPage,
});

function CollectionPage() {
  return (
    <AppShell variant="page">
      <CollectionView />
    </AppShell>
  );
}

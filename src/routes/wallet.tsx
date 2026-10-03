import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/app-shell";
import { WalletView } from "@/components/wallet/wallet-view";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
});

function WalletPage() {
  return (
    <AppShell variant="page">
      <WalletView />
    </AppShell>
  );
}

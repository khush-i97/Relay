import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RedeemSheet } from "@/components/wallet/redeem-sheet";
import { useApplySummary, useRefreshLedger, useWallet } from "@/hooks/queries";
import { getApi, isMockMode } from "@/lib/client";
import { formatCents, formatWhen } from "@/lib/format";
import { INITIAL_CAMERA, SF_CENTER } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";

export function WalletView() {
  const wallet = useWallet();
  const apply = useApplySummary();
  const refresh = useRefreshLedger();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const balance = wallet.data?.balanceCents ?? 0;

  async function resetDemo() {
    await getApi().resetDemo();
    client.clear();
    useUi.setState({
      selected: null,
      overlay: null,
      plan: null,
      location: null,
      browseMode: "demo",
      searchCenter: SF_CENTER,
      camera: INITIAL_CAMERA,
      celebratedVisitIds: [],
      cuisine: null,
      fly: { nonce: Date.now(), camera: INITIAL_CAMERA },
    });
    setNote("Demo reset. Balance is $0.00.");
    setOpen(false);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 pb-28 lg:pb-8">
      <h1 className="font-display text-3xl font-semibold">Wallet</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Rewards are platform-funded. Restaurants do not pay for this demo, and XP is never spent here.
      </p>
      {wallet.isLoading ? (
        <div className="mt-5 space-y-3">
          <div className="h-24 animate-pulse rounded-3xl bg-paper-2" />
          <div className="h-16 animate-pulse rounded-2xl bg-paper-2" />
          <div className="h-16 animate-pulse rounded-2xl bg-paper-2" />
        </div>
      ) : null}
      {wallet.isError ? (
        <div className="mt-5 rounded-3xl bg-paper-2 p-5">
          <p className="text-sm">Couldn't load the wallet. Nothing was changed locally.</p>
          <Button className="mt-3" variant="secondary" onClick={() => void wallet.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}
      {wallet.data ? (
        <>
          <section className="mt-5 rounded-3xl bg-ink p-5 text-paper">
            <p className="text-sm text-paper/80">Available balance</p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums">{formatCents(balance)}</p>
            <p className="mt-2 text-sm text-paper/80">
              Today {formatCents(wallet.data.earnedTodayCents)} of {formatCents(wallet.data.dailyCapCents)} · reward funding{" "}
              {wallet.data.rewardFunding}
            </p>
          </section>
          {balance === 0 && wallet.data.entries.length === 0 ? (
            <div className="mt-4 rounded-3xl bg-paper-2 p-5">
              <p className="font-semibold">$0.00</p>
              <p className="mt-1 text-sm text-muted">Check in on the map to earn a platform-funded reward.</p>
              <Link to="/" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-chili-deep px-4 text-sm font-medium text-paper">
                Explore
              </Link>
            </div>
          ) : (
            <Button className="mt-4" onClick={() => setOpen(true)} disabled={balance < 1}>
              Use rewards at a restaurant
            </Button>
          )}
          <h2 className="mt-8 font-display text-2xl font-semibold">Activity</h2>
          {wallet.data.entries.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No rewards or redemptions yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {wallet.data.entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.restaurantName}</p>
                    <p className="text-sm text-muted">
                      {formatWhen(entry.createdAt)} · {entry.label}
                    </p>
                  </div>
                  <p className={cn("shrink-0 font-semibold tabular-nums", entry.amountCents < 0 ? "text-chili-deep" : "text-olive")}>
                    {entry.amountCents > 0 ? "+" : ""}
                    {formatCents(entry.amountCents)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
      {note ? <p className="mt-4 text-sm text-olive">{note}</p> : null}
      {isMockMode() ? (
        <button type="button" className="mt-6 min-h-11 text-sm text-muted underline" onClick={() => void resetDemo()}>
          Reset demo session
        </button>
      ) : null}
      <p className="mt-2 text-xs text-muted">This demo remembers the session on this device until you reset it.</p>
      <RedeemSheet
        open={open}
        restaurantId={null}
        onOpenChange={setOpen}
        onSuccess={(result) => {
          apply(result.summary);
          refresh();
        }}
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useCatalog, useSummary, useWallet } from "@/hooks/queries";
import { ApiError, userMessage } from "@/lib/api-error";
import { getApi } from "@/lib/client";
import type { RedemptionResponse } from "@/lib/contracts";
import { centsToInput, formatCents, parseDollarInput } from "@/lib/format";
import { MAX_REDEEM_CENTS } from "@/lib/rules";

type Props = {
  open: boolean;
  restaurantId: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: RedemptionResponse) => void;
};

type Pending = { key: string; receiptId: string; signature: string };

export function RedeemSheet({ open, restaurantId, onOpenChange, onSuccess }: Props) {
  const summary = useSummary();
  const wallet = useWallet();
  const catalog = useCatalog();
  const [chosenId, setChosenId] = useState<string | null>(restaurantId);
  const [bill, setBill] = useState("20.00");
  const [reward, setReward] = useState("0.30");
  const [phase, setPhase] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<RedemptionResponse | null>(null);
  const [query, setQuery] = useState("");
  const pending = useRef<Pending | null>(null);

  useEffect(() => {
    if (open) {
      setChosenId(restaurantId);
      setPhase("idle");
      setError(null);
      setResult(null);
      pending.current = null;
    }
  }, [open, restaurantId]);

  const restaurant = catalog.data?.restaurants.find((item) => item.id === chosenId) ?? null;
  const balance = summary.data?.balanceCents ?? 0;
  const billCents = parseDollarInput(bill);
  const rewardCents = parseDollarInput(reward);
  const maxReward = Math.min(balance, billCents ?? MAX_REDEEM_CENTS, MAX_REDEEM_CENTS);
  const earnedElsewhere = (wallet.data?.entries ?? []).some(
    (entry) => entry.kind === "earn" && entry.restaurantId !== chosenId,
  );
  const hasEarn = (wallet.data?.entries ?? []).some((entry) => entry.kind === "earn");

  const preview = useMemo(() => {
    if (billCents == null || rewardCents == null) return null;
    return {
      bill: billCents,
      reward: rewardCents,
      personal: Math.max(billCents - rewardCents, 0),
      after: balance - rewardCents,
    };
  }, [billCents, rewardCents, balance]);

  const options = (catalog.data?.restaurants ?? []).filter((item) => {
    const hay = `${item.name} ${item.cuisine}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  async function submit() {
    if (!restaurant || billCents == null || rewardCents == null) return;
    if (rewardCents > balance) {
      setError(new ApiError("INSUFFICIENT_BALANCE", "Lower the reward amount.", { status: 409 }));
      return;
    }
    const draft = {
      restaurantId: restaurant.id,
      billAmountCents: billCents,
      rewardAmountCents: rewardCents,
    };
    const signature = JSON.stringify(draft);
    if (!pending.current || pending.current.signature !== signature) {
      pending.current = { key: crypto.randomUUID(), receiptId: crypto.randomUUID(), signature };
    }
    setPhase("submitting");
    setError(null);
    try {
      const response = await getApi().createRedemption(
        { ...draft, demoReceiptId: pending.current.receiptId },
        pending.current.key,
      );
      setResult(response);
      setPhase("done");
      onSuccess(response);
    } catch (caught) {
      setPhase("idle");
      setError(caught);
    }
  }

  const apiError = error instanceof ApiError ? error : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (phase === "submitting") return;
        onOpenChange(next);
      }}
      title={phase === "done" ? "Demo redemption" : "Use rewards"}
      description="Platform-funded credits. This does not pay the restaurant."
      footer={
        phase === "done" ? (
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : restaurant ? (
          <Button className="w-full" onClick={() => void submit()} disabled={phase === "submitting" || balance < 1}>
            {phase === "submitting" ? "Applying reward…" : apiError?.retryable ? "Retry confirmation" : "Confirm"}
          </Button>
        ) : null
      }
    >
      {phase === "done" && result ? (
        <div className="space-y-2 text-sm">
          <p>{result.message}</p>
          <p className="font-semibold tabular-nums">Reward applied {formatCents(result.rewardAmountCents)}</p>
          <p className="tabular-nums">Wallet balance {formatCents(result.balanceCents)}</p>
          <p className="text-muted">Settlement: {result.settlementStatus}</p>
        </div>
      ) : null}

      {phase !== "done" && !restaurant ? (
        <div>
          <p className="text-sm text-muted">Choose a catalog restaurant. Rewards move with you — spend them somewhere you didn't just earn them.</p>
          <label className="mt-3 block text-sm font-medium" htmlFor="redeem-search">
            Search
          </label>
          <input
            id="redeem-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm outline-none"
          />
          <ul className="mt-3 grid gap-2">
            {options.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between rounded-2xl bg-paper-2 px-3 text-left text-sm"
                  onClick={() => setChosenId(item.id)}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted">{item.cuisine}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {phase !== "done" && restaurant ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-olive">Demo venue</p>
              <p className="font-display text-xl font-semibold">{restaurant.name}</p>
            </div>
            <Button variant="ghost" onClick={() => setChosenId(null)}>
              Change
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted">
            Available {formatCents(balance)}. A redemption can be 1 cent up to the lesser of your balance, the bill, and $5.
          </p>
          {!hasEarn || !earnedElsewhere ? (
            <p className="mt-2 text-sm text-chili-deep">
              Earn a reward at a different restaurant first. Credits are portable — spend them somewhere else.
            </p>
          ) : null}
          <label className="mt-4 block text-sm font-medium" htmlFor="redeem-bill">
            Total bill
          </label>
          <input
            id="redeem-bill"
            inputMode="decimal"
            value={bill}
            onChange={(event) => {
              setBill(event.target.value);
              setError(null);
            }}
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3 tabular-nums outline-none"
          />
          <label className="mt-3 block text-sm font-medium" htmlFor="redeem-reward">
            Reward amount
          </label>
          <input
            id="redeem-reward"
            inputMode="decimal"
            value={reward}
            onChange={(event) => {
              setReward(event.target.value);
              setError(null);
            }}
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3 tabular-nums outline-none"
          />
          <div className="mt-2 flex gap-2">
            {maxReward >= 30 ? (
              <Button variant="secondary" onClick={() => setReward("0.30")}>
                $0.30
              </Button>
            ) : null}
            {maxReward >= 1 ? (
              <Button variant="secondary" onClick={() => setReward(centsToInput(maxReward))}>
                Max {formatCents(maxReward)}
              </Button>
            ) : null}
          </div>
          {preview ? (
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-paper-2 p-3">
                <dt className="text-muted">Bill</dt>
                <dd className="font-semibold tabular-nums">{formatCents(preview.bill)}</dd>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <dt className="text-muted">Reward</dt>
                <dd className="font-semibold tabular-nums">{formatCents(preview.reward)}</dd>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <dt className="text-muted">You pay</dt>
                <dd className="font-semibold tabular-nums">{formatCents(preview.personal)}</dd>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <dt className="text-muted">Balance after</dt>
                <dd className="font-semibold tabular-nums">{formatCents(preview.after)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">Enter a bill and a reward in dollars.</p>
          )}
          <p className="mt-2 text-xs text-muted">Preview is an estimate. The final confirmation uses the server response.</p>
          {balance < 1 ? <p className="mt-2 text-sm text-chili-deep">You don't have rewards yet. Check in on Explore first.</p> : null}
          {apiError?.code === "INSUFFICIENT_BALANCE" ? (
            <p className="mt-2 text-sm text-chili-deep">Lower the reward amount. Your bill stays as entered.</p>
          ) : null}
          {error && apiError?.code !== "INSUFFICIENT_BALANCE" ? (
            <p className="mt-2 text-sm text-chili-deep">{userMessage(error)}</p>
          ) : null}
          {apiError?.code === "IDEMPOTENCY_CONFLICT" ? (
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => {
                pending.current = null;
                setError(null);
              }}
            >
              Start a new confirmation
            </Button>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

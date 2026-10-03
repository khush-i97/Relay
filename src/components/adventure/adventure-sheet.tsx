import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { RarityBadge } from "@/components/restaurants/rarity";
import { getApi } from "@/lib/client";
import type { AdventurePlan, AdventureRequest, Coordinates } from "@/lib/contracts";
import { formatCents, formatXp, parseDollarInput } from "@/lib/format";
import { userMessage, isAbort } from "@/lib/api-error";

type Props = {
  open: boolean;
  origin: Coordinates;
  onOpenChange: (open: boolean) => void;
  onPlan: (plan: AdventurePlan) => void;
  onStart: (plan: AdventurePlan) => void;
};

const PRESETS = ["Chinese", "Ramen", "Tacos", "Seafood", "Legendary"];

export function AdventureSheet({ open, origin, onOpenChange, onPlan, onStart }: Props) {
  const [budget, setBudget] = useState("30");
  const [minutes, setMinutes] = useState("90");
  const [stops, setStops] = useState(2);
  const [preferences, setPreferences] = useState("");
  const [onlyUndiscovered, setOnlyUndiscovered] = useState(true);
  const [messages, setMessages] = useState<string[]>([]);
  const [phase, setPhase] = useState<"idle" | "running" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AdventurePlan | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
  }

  async function planRoute() {
    const spend = parseDollarInput(budget.includes(".") ? budget : `${budget}.00`);
    const duration = Number(minutes);
    if (spend == null) {
      setError("Enter a budget in dollars.");
      setPhase("error");
      return;
    }
    if (!Number.isInteger(duration) || duration < 20) {
      setError("Allow at least 20 minutes.");
      setPhase("error");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages([]);
    setError(null);
    setPhase("running");
    const body: AdventureRequest = {
      maxSpendCents: spend,
      maxDurationMinutes: duration,
      maxStops: stops,
      preferences,
      onlyUndiscovered,
      origin,
    };
    try {
      await getApi().streamAdventure(body, controller.signal, (event) => {
        if (event.type === "progress") setMessages((current) => [...current, event.message]);
        if (event.type === "error") {
          setError(event.error.message);
          setPhase("error");
        }
        if (event.type === "complete") {
          setPlan(event.plan);
          onPlan(event.plan);
          setPhase("ready");
        }
      });
    } catch (caught) {
      if (isAbort(caught) || controller.signal.aborted) {
        setPhase((current) => (current === "running" ? "idle" : current));
        return;
      }
      setError(userMessage(caught));
      setPhase("error");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) cancel();
        onOpenChange(next);
      }}
      title="Adventure"
      description="A short eating route. Planning doesn't spend rewards."
      footer={
        phase === "ready" && plan ? (
          <Button className="w-full" onClick={() => onStart(plan)}>
            Start adventure
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {phase === "running" ? (
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => void planRoute()} disabled={phase === "running"}>
              {phase === "running" ? "Planning…" : phase === "error" ? "Try again" : "Plan route"}
            </Button>
          </div>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium" htmlFor="adv-budget">
          Budget
          <input
            id="adv-budget"
            inputMode="decimal"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3 tabular-nums outline-none"
          />
        </label>
        <label className="text-sm font-medium" htmlFor="adv-minutes">
          Minutes
          <input
            id="adv-minutes"
            inputMode="numeric"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3 tabular-nums outline-none"
          />
        </label>
      </div>
      <p className="mt-3 text-sm font-medium">Stops</p>
      <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Number of stops">
        {[1, 2, 3].map((count) => (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={stops === count}
            className={
              stops === count
                ? "min-h-11 rounded-full bg-ink text-sm font-semibold text-paper"
                : "min-h-11 rounded-full border border-line text-sm"
            }
            onClick={() => setStops(count)}
          >
            {count}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-sm font-medium" htmlFor="adv-pref">
        Preferences
      </label>
      <input
        id="adv-pref"
        value={preferences}
        onChange={(event) => setPreferences(event.target.value)}
        placeholder="ramen, tacos, legendary"
        className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="min-h-11 rounded-full bg-paper-2 px-3 text-sm"
            onClick={() => setPreferences(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={onlyUndiscovered}
        className="mt-3 flex min-h-11 w-full items-center justify-between rounded-2xl bg-paper-2 px-3 text-sm"
        onClick={() => setOnlyUndiscovered((value) => !value)}
      >
        <span>Undiscovered only</span>
        <span className={onlyUndiscovered ? "font-semibold text-olive" : "text-muted"}>
          {onlyUndiscovered ? "On" : "Off"}
        </span>
      </button>
      <ul className="mt-4 space-y-1 text-sm text-muted" aria-live="polite">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      {error ? <p className="mt-3 text-sm text-chili-deep">{error}</p> : null}
      {plan && phase === "ready" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold">Approximate walking route</p>
          <p className="text-xs text-muted">Not turn-by-turn directions. Totals come from the planner.</p>
          <ol className="space-y-2">
            {plan.stops.map((stop) => (
              <li key={stop.restaurantId} className="rounded-2xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {stop.order}. {stop.name}
                  </p>
                  <RarityBadge rarity={stop.rarity} />
                </div>
                <p className="mt-1 text-sm text-muted">{stop.reason}</p>
                <p className="mt-2 text-sm tabular-nums">
                  Est. {formatCents(stop.estimatedMealCents)} · {stop.xp > 0 ? formatXp(stop.xp) : "0 XP"} ·{" "}
                  {formatCents(stop.potentialRewardCents)}
                </p>
              </li>
            ))}
          </ol>
          <p className="text-sm tabular-nums">
            {formatCents(plan.totalEstimatedMealCents)} meals · {formatXp(plan.totalXp)} ·{" "}
            {formatCents(plan.totalPotentialRewardCents)} possible · about {plan.totalWalkMinutes} min
          </p>
          <p className="text-xs text-muted">Start adventure selects the first stop. It does not check you in or grant rewards.</p>
        </div>
      ) : null}
    </Sheet>
  );
}

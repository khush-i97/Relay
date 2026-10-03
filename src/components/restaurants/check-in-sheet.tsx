import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ApiError, userMessage } from "@/lib/api-error";
import { getApi } from "@/lib/client";
import type { LocationFix, NearbyRestaurant, VisitRequest, VisitResponse } from "@/lib/contracts";
import { centsToInput, formatDistance, parseDollarInput } from "@/lib/format";
import { haversine } from "@/lib/geo";
import { captureBrowserLocation } from "@/lib/location";
import { LOCATION_MAX_ACCURACY_M, LOCATION_MAX_AGE_MS, LOCATION_MAX_DISTANCE_M, MIN_BILL_CENTS } from "@/lib/rules";
import { useSummary } from "@/hooks/queries";

type Props = {
  restaurant: NearbyRestaurant | null;
  open: boolean;
  location: LocationFix | null;
  onLocation: (fix: LocationFix) => void;
  onClose: () => void;
  onSuccess: (result: VisitResponse) => void;
};

type Pending = { key: string; receiptId: string; signature: string };

function signatureOf(body: Omit<VisitRequest, "receiptId">) {
  return JSON.stringify(body);
}

export function CheckInSheet({ restaurant, open, location, onLocation, onClose, onSuccess }: Props) {
  const summary = useSummary();
  const demo = summary.data?.verificationMode === "demo";
  const [bill, setBill] = useState("");
  const [phase, setPhase] = useState<"idle" | "locating" | "submitting">("idle");
  const [error, setError] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef<Pending | null>(null);
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (!restaurant) return;
    if (seededFor.current === restaurant.id) return;
    seededFor.current = restaurant.id;
    setBill(centsToInput(restaurant.estimatedMealCents));
    pending.current = null;
    setError(null);
    setPhase("idle");
  }, [restaurant]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!restaurant) return null;

  const age = location ? now - Date.parse(location.capturedAt) : null;
  const distance = location ? haversine(location, restaurant.coordinates) : null;
  const stale = age == null || age > LOCATION_MAX_AGE_MS;
  const inaccurate = location != null && location.accuracyMeters > LOCATION_MAX_ACCURACY_M;
  const far = distance != null && distance > LOCATION_MAX_DISTANCE_M;

  async function locate() {
    setPhase("locating");
    setError(null);
    try {
      const fix = await captureBrowserLocation();
      onLocation(fix);
      setPhase("idle");
    } catch (caught) {
      setError(caught);
      setPhase("idle");
    }
  }

  function simulate() {
    onLocation({
      latitude: restaurant!.coordinates.latitude,
      longitude: restaurant!.coordinates.longitude,
      accuracyMeters: 8,
      capturedAt: new Date().toISOString(),
      simulated: true,
    });
    setError(null);
    setPhase("idle");
  }

  async function submit() {
    if (!location || !restaurant) return;
    const cents = parseDollarInput(bill);
    if (cents == null || cents < MIN_BILL_CENTS) {
      setError(new ApiError("PURCHASE_TOO_SMALL", "Enter a demo bill of at least $5", { status: 422 }));
      return;
    }
    const draft = {
      restaurantId: restaurant.id,
      billAmountCents: cents,
      location,
    };
    const signature = signatureOf(draft);
    if (!pending.current || pending.current.signature !== signature) {
      pending.current = { key: crypto.randomUUID(), receiptId: crypto.randomUUID(), signature };
    }
    const body: VisitRequest = { ...draft, receiptId: pending.current.receiptId };
    setPhase("submitting");
    setError(null);
    try {
      const result = await getApi().createVisit(body, pending.current.key);
      setPhase("idle");
      onSuccess(result);
    } catch (caught) {
      setPhase("idle");
      setError(caught);
    }
  }

  const apiError = error instanceof ApiError ? error : null;
  const retryable = apiError?.retryable === true;
  const conflict = apiError?.code === "IDEMPOTENCY_CONFLICT";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && phase !== "submitting") onClose();
      }}
      title="Check in"
      description="Confirm a simulated purchase. Nothing is charged."
      footer={
        <div className="grid gap-2">
          {conflict ? (
            <Button
              variant="secondary"
              onClick={() => {
                pending.current = null;
                setError(null);
              }}
            >
              Start a new confirmation
            </Button>
          ) : null}
          <Button onClick={() => void submit()} disabled={phase !== "idle" || !location}>
            {phase === "submitting" ? "Submitting…" : retryable ? "Retry confirmation" : "Confirm simulated purchase"}
          </Button>
        </div>
      }
    >
      <div className="rounded-2xl border border-gold bg-gold/30 px-3 py-2 text-sm font-medium text-ink">
        Demo purchase — nothing is charged.
      </div>
      <div className="mt-4" aria-live="polite">
        <p className="text-sm font-semibold">{restaurant.name}</p>
        {location ? (
          <p className="mt-2 text-sm text-muted">
            {location.simulated
              ? "Simulated location at this restaurant. This is not real GPS verification."
              : `GPS fix · ${Math.round(location.accuracyMeters)} m accuracy · ${age != null && age >= 0 ? `${Math.round(age / 1000)}s ago` : "just now"}`}
            {distance != null ? ` · ${formatDistance(distance)} from the door` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Capture a location, or use the labeled demo action.</p>
        )}
        {location?.simulated ? null : stale && location ? (
          <p className="mt-2 text-sm text-chili-deep">Refresh your location and try again</p>
        ) : null}
        {inaccurate ? <p className="mt-2 text-sm text-chili-deep">Refresh your location and try again</p> : null}
        {far ? <p className="mt-2 text-sm text-chili-deep">Move closer or use the labeled demo location action</p> : null}
      </div>
      <div className="mt-4 grid gap-2">
        <Button variant="secondary" onClick={() => void locate()} disabled={phase !== "idle"}>
          {phase === "locating" ? "Finding you…" : "Use my location"}
        </Button>
        {demo ? (
          <Button variant="secondary" onClick={simulate} disabled={phase !== "idle"}>
            Simulate location at this restaurant
          </Button>
        ) : null}
      </div>
      <label className="mt-4 block text-sm font-medium" htmlFor="demo-bill">
        Demo bill
      </label>
      <div className="mt-1 flex items-center gap-2 rounded-2xl border border-line bg-paper px-3">
        <span className="text-muted" aria-hidden>
          $
        </span>
        <input
          id="demo-bill"
          inputMode="decimal"
          autoComplete="off"
          value={bill}
          onChange={(event) => {
            setBill(event.target.value);
            setError(null);
          }}
          className="min-h-11 w-full bg-transparent text-base tabular-nums outline-none"
        />
      </div>
      <p id="bill-hint" className="mt-1 text-xs text-muted">
        At least $5. The estimate is filled in so you can edit it.
      </p>
      {error ? <p className="mt-3 text-sm text-chili-deep">{userMessage(error)}</p> : null}
    </Sheet>
  );
}

import { Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CuisineIcon } from "@/components/restaurants/cuisine";
import { RarityBadge } from "@/components/restaurants/rarity";
import { ApiError, userMessage } from "@/lib/api-error";
import type { NearbyRestaurant } from "@/lib/contracts";
import { formatCents, formatDistance, formatXp } from "@/lib/format";
import { venueMenu } from "@/lib/menus";
import { cn } from "@/lib/utils";

type Props = {
  restaurant: NearbyRestaurant | null;
  loading: boolean;
  missing: boolean;
  onClose: () => void;
  onCheckIn: () => void;
  onRedeem: () => void;
  onWalk: () => void;
  walking: boolean;
  walkError: string | null;
  onBackToDemo: () => void;
};

export function RestaurantPanel({
  restaurant,
  loading,
  missing,
  onClose,
  onCheckIn,
  onRedeem,
  onWalk,
  walking,
  walkError,
  onBackToDemo,
}: Props) {
  if (!restaurant && !loading && !missing) return null;

  return (
    <aside className="venue-panel" aria-labelledby="venue-title">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <p className="text-xs font-semibold tracking-wide text-olive">Demo venue</p>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-full" aria-label="Close restaurant details" onClick={onClose}>
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {loading && !restaurant ? (
          <div className="space-y-3">
            <div className="h-8 w-2/3 animate-pulse rounded-lg bg-paper-2" />
            <div className="h-4 w-1/2 animate-pulse rounded-lg bg-paper-2" />
            <div className="h-20 animate-pulse rounded-2xl bg-paper-2" />
          </div>
        ) : null}
        {missing && !restaurant ? (
          <div className="pb-4">
            <h2 id="venue-title" className="font-display text-2xl font-semibold">
              Not in this search
            </h2>
            <p className="mt-2 text-sm text-muted">This venue isn't inside the current area.</p>
            <Button className="mt-4" variant="secondary" onClick={onBackToDemo}>
              Back to SF demo
            </Button>
          </div>
        ) : null}
        {restaurant ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-paper-2 text-ink">
                <CuisineIcon cuisine={restaurant.cuisine} className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 id="venue-title" className="font-display text-2xl font-semibold leading-tight">
                  {restaurant.name}
                </h2>
                <p className="text-sm text-muted">{restaurant.cuisine}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RarityBadge rarity={restaurant.rarity} />
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", restaurant.collected ? "bg-olive text-paper" : "bg-paper-2 text-ink")}>
                {restaurant.collected ? "In your collection" : "Undiscovered"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-paper-2 p-3">
                <dt className="text-muted">First discovery</dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {restaurant.collected ? "XP already awarded" : formatXp(restaurant.firstDiscoveryXp)}
                </dd>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <dt className="text-muted">Visit reward</dt>
                <dd className="mt-1 font-semibold tabular-nums">{formatCents(restaurant.rewardCents)}</dd>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <dt className="text-muted">Meal price</dt>
                <dd className="mt-1 font-semibold tabular-nums">Est. {formatCents(restaurant.estimatedMealCents)}</dd>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <dt className="text-muted">Distance</dt>
                <dd className="mt-1 font-semibold tabular-nums">{formatDistance(restaurant.distanceMeters)} straight-line</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-muted">
              {restaurant.rewardEligible
                ? "A qualifying visit adds this reward. Only the first discovery grants XP."
                : userMessage(new ApiError(restaurant.ineligibleCode ?? "HTTP_ERROR", "Not eligible right now."))}
            </p>
            {restaurant.availability ? <p className="mt-2 text-sm">{restaurant.availability}</p> : null}
            <MenuBlock id={restaurant.id} />
          </div>
        ) : null}
      </div>
      {restaurant ? (
        <div className="safe-bottom grid gap-2 border-t border-line p-4">
          <Button variant="olive" onClick={onWalk} disabled={walking}>
            <Navigation className="size-4" aria-hidden />
            {walking ? "Finding streets…" : "Walk there"}
          </Button>
          {walkError ? <p className="text-sm text-chili-deep">{walkError}</p> : null}
          <Button onClick={onCheckIn}>Check in</Button>
          <Button variant="secondary" onClick={onRedeem}>
            Use rewards
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

function MenuBlock({ id }: { id: string }) {
  const menu = venueMenu(id);
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold tracking-wide text-olive">Sample menu</h3>
      <ul className="mt-1">
        {menu.items.map((item) => (
          <li key={item.name} className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{item.name}</span>
              <span className="block text-xs text-muted">{item.note}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCents(item.cents)}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 text-xs font-semibold tracking-wide text-olive">Demo notes</h3>
      <ul className="mt-2 space-y-2">
        {menu.notes.map((note) => (
          <li key={note.by} className="rounded-2xl bg-paper-2 px-3 py-2">
            <p className="text-sm">“{note.quote}”</p>
            <p className="mt-1 text-xs text-muted">{note.by}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Demo copy for the hackathon. Not a live menu or live reviews.</p>
    </div>
  );
}

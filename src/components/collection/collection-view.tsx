import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CuisineIcon } from "@/components/restaurants/cuisine";
import { RarityBadge } from "@/components/restaurants/rarity";
import { useCollection } from "@/hooks/queries";
import { CUISINES } from "@/lib/fixtures";
import { formatWhen, formatXp } from "@/lib/format";
import { SF_CENTER } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";

export function CollectionView() {
  const collection = useCollection();
  const [cuisine, setCuisine] = useState<string | null>(null);
  const select = useUi((state) => state.select);
  const setSearchCenter = useUi((state) => state.setSearchCenter);
  const rows = (collection.data?.restaurants ?? []).filter((restaurant) => !cuisine || restaurant.cuisine === cuisine);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 pb-28 lg:pb-8">
      <h1 className="font-display text-3xl font-semibold">Collection</h1>
      <p className="mt-1 text-sm text-muted">
        {collection.data ? `${collection.data.count} discovered` : "Loading your stamps"}
      </p>
      <div className="chip-row mt-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={cuisine === null} onClick={() => setCuisine(null)}>
          All
        </FilterChip>
        {CUISINES.map((item) => (
          <FilterChip key={item} active={cuisine === item} onClick={() => setCuisine(item)}>
            {item}
          </FilterChip>
        ))}
      </div>
      {collection.isLoading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-3xl bg-paper-2" />
          ))}
        </div>
      ) : null}
      {collection.isError ? (
        <div className="mt-6 rounded-3xl bg-paper-2 p-5">
          <p className="text-sm">Couldn't load your collection.</p>
          <Button className="mt-3" variant="secondary" onClick={() => void collection.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}
      {collection.data && collection.data.count === 0 ? (
        <div className="mt-6 rounded-3xl bg-paper-2 p-6">
          <h2 className="font-display text-2xl font-semibold">Nothing stamped yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            Check in after a demo purchase on the map. The first discovery is the one that grants XP.
          </p>
          <Link to="/" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-chili-deep px-4 text-sm font-medium text-paper">
            Back to Explore
          </Link>
        </div>
      ) : null}
      {collection.data && collection.data.count > 0 && rows.length === 0 ? (
        <div className="mt-6">
          <p className="text-sm">No {cuisine} stamps yet.</p>
          <Button className="mt-3" variant="secondary" onClick={() => setCuisine(null)}>
            Reset filters
          </Button>
        </div>
      ) : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((restaurant) => (
          <li key={restaurant.id}>
            <Link
              to="/"
              className="flex h-full flex-col rounded-3xl border border-line bg-paper p-4"
              onClick={() => {
                setSearchCenter(SF_CENTER);
                select({
                  id: restaurant.id,
                  latitude: restaurant.coordinates.latitude,
                  longitude: restaurant.coordinates.longitude,
                });
              }}
            >
              <span className="flex size-11 items-center justify-center rounded-2xl bg-paper-2">
                <CuisineIcon cuisine={restaurant.cuisine} className="size-5" />
              </span>
              <span className="mt-3 font-display text-xl font-semibold">{restaurant.name}</span>
              <span className="text-sm text-muted">{restaurant.cuisine}</span>
              <span className="mt-3">
                <RarityBadge rarity={restaurant.rarity} />
              </span>
              <span className="mt-3 text-sm text-muted">{formatWhen(restaurant.discoveredAt)}</span>
              <span className="text-sm tabular-nums">{formatXp(restaurant.xpAwarded)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={cn("min-h-11 shrink-0 rounded-full px-3 text-sm", active ? "bg-ink text-paper" : "bg-paper-2 text-ink")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

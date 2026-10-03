import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { RarityBadge } from "@/components/restaurants/rarity";
import type { NearbyRestaurant, VisitResponse } from "@/lib/contracts";
import { formatCents, formatXp } from "@/lib/format";

type Props = {
  result: VisitResponse | null;
  restaurant: NearbyRestaurant | null;
  onDone: () => void;
  onCommit: (result: VisitResponse) => void;
};

export function Celebration({ result, restaurant, onDone, onCommit }: Props) {
  const reduced = useReducedMotion();
  const committed = useRef(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    committed.current = false;
  }, [result?.visitId]);

  useEffect(() => {
    if (!result) return;
    const commit = () => {
      if (committed.current) return;
      committed.current = true;
      onCommitRef.current(result);
    };
    if (reduced) {
      commit();
      return;
    }
    const timer = setTimeout(commit, 700);
    return () => clearTimeout(timer);
  }, [result, reduced]);

  useEffect(() => {
    if (!result || result.replayed || reduced) return;
    if (!result.firstDiscovery && !result.leveledUp) return;
    let cancelled = false;
    void import("canvas-confetti").then((mod) => {
      if (cancelled) return;
      void mod.default({
        particleCount: 80,
        spread: 68,
        origin: { y: 0.62 },
        colors: ["#9e2a22", "#e2b657", "#2f6b4f", "#f6f1e8"],
        disableForReducedMotion: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [result, reduced]);

  if (!result) return null;
  const compact = result.replayed || !result.firstDiscovery;
  const name = restaurant?.name ?? "This restaurant";

  return (
    <Sheet
      open
      dismissible
      variant="card"
      title={compact ? (result.replayed ? "Already confirmed" : "Reward added") : "Collected"}
      description={compact ? "No new discovery XP." : "First discovery."}
      onOpenChange={(next) => {
        if (!next) {
          if (!committed.current) {
            committed.current = true;
            onCommit(result);
          }
          onDone();
        }
      }}
      footer={
        <Button
          className="w-full"
          onClick={() => {
            if (!committed.current) {
              committed.current = true;
              onCommit(result);
            }
            onDone();
          }}
        >
          Continue
        </Button>
      }
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        className="rounded-3xl border border-line bg-paper-2 p-4"
      >
        <p className="text-xs font-semibold tracking-wide text-olive">Demo venue</p>
        <h3 className="mt-2 font-display text-2xl font-semibold">{name}</h3>
        {restaurant ? (
          <div className="mt-3">
            <RarityBadge rarity={restaurant.rarity} />
          </div>
        ) : null}
        <p className="mt-4 text-lg font-semibold tabular-nums">
          {result.xpAwarded > 0 ? `+${formatXp(result.xpAwarded)}` : "No discovery XP"}
        </p>
        <p className="text-lg font-semibold tabular-nums text-olive">+{formatCents(result.creditAwardedCents)}</p>
        {result.leveledUp ? <p className="mt-2 text-sm font-medium">Level {result.levelAfter}</p> : null}
        {result.replayed ? (
          <p className="mt-2 text-sm text-muted">This visit was already confirmed. Your balance was not changed again.</p>
        ) : null}
      </motion.div>
    </Sheet>
  );
}

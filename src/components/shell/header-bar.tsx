import { Mark } from "@/components/brand/mark";
import { useSummary } from "@/hooks/queries";
import { formatCents } from "@/lib/format";

export function HeaderBar() {
  const summary = useSummary();
  const data = summary.data;
  const progress = data ? Math.min(100, (data.xpIntoLevel / data.xpPerLevel) * 100) : 0;

  return (
    <header className="safe-top border-b border-line bg-paper text-ink">
      <div className="flex h-14 items-center justify-between gap-3 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Mark />
          <span className="truncate font-display text-xl font-semibold italic">Relay</span>
        </div>
        <div className="flex items-center gap-2">
          {data ? (
            <>
              <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-paper tabular-nums">
                Lv {data.level}
              </span>
              <span className="text-sm font-semibold tabular-nums">{formatCents(data.balanceCents)}</span>
            </>
          ) : (
            <span className="h-6 w-24 animate-pulse rounded-full bg-paper-2" />
          )}
        </div>
      </div>
      <div className="px-3 pb-2">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-paper-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={data?.xpPerLevel ?? 1000}
          aria-valuenow={data?.xpIntoLevel ?? 0}
          aria-label="XP toward the next level"
        >
          <div className="h-full rounded-full bg-chili-deep" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted tabular-nums">
          {data ? `${data.xpIntoLevel} / ${data.xpPerLevel} XP` : "Loading your trail"}
        </p>
      </div>
    </header>
  );
}

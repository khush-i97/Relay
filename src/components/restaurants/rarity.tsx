import { Circle, Crown, Gem, Hexagon, type LucideIcon } from "lucide-react";
import type { Rarity } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export const RARITY_META: Record<
  Rarity,
  { label: string; ring: string; badge: string; glyph: string; icon: LucideIcon }
> = {
  common: {
    label: "Common",
    ring: "ring-muted",
    badge: "bg-muted text-paper",
    glyph: "text-muted",
    icon: Circle,
  },
  rare: {
    label: "Rare",
    ring: "ring-olive",
    badge: "bg-olive text-paper",
    glyph: "text-olive",
    icon: Hexagon,
  },
  epic: {
    label: "Epic",
    ring: "ring-chili-deep",
    badge: "bg-chili-deep text-paper",
    glyph: "text-chili-deep",
    icon: Gem,
  },
  legendary: {
    label: "Legendary",
    ring: "ring-gold-deep",
    badge: "bg-gold text-ink",
    glyph: "text-gold-deep",
    icon: Crown,
  },
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const meta = RARITY_META[rarity];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", meta.badge)}>
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

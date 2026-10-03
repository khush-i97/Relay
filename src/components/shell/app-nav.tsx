import { Link } from "@tanstack/react-router";
import { BookMarked, Map, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Explore", icon: Map, exact: true },
  { to: "/collection", label: "Collection", icon: BookMarked, exact: false },
  { to: "/wallet", label: "Wallet", icon: Wallet, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav className="safe-bottom absolute inset-x-0 bottom-0 z-40 border-t border-line bg-paper lg:hidden" aria-label="Primary">
      <ul className="grid grid-cols-3">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs text-muted"
              activeProps={{ className: "text-chili-deep font-semibold" }}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SideNav() {
  return (
    <nav className="hidden w-24 shrink-0 flex-col gap-2 border-r border-line bg-paper px-2 py-4 lg:flex" aria-label="Primary">
      {ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          className={cn(
            "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs text-muted",
          )}
          activeProps={{ className: "bg-paper-2 text-chili-deep font-semibold" }}
        >
          <item.icon className="size-5" aria-hidden />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

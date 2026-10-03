import type { ReactNode } from "react";
import { BottomNav, SideNav } from "@/components/shell/app-nav";
import { HeaderBar } from "@/components/shell/header-bar";

export function AppShell({ variant, children }: { variant: "map" | "page"; children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <SideNav />
      <div className="relative flex min-w-0 flex-1 flex-col">
        {variant === "page" ? <HeaderBar /> : null}
        <div className={variant === "page" ? "min-h-0 flex-1 overflow-y-auto" : "relative min-h-0 flex-1"}>
          {children}
        </div>
        <BottomNav />
      </div>
    </div>
  );
}

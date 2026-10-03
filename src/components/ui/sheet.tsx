import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "sheet" | "card";
  dismissible?: boolean;
};

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  variant = "sheet",
  dismissible = true,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[min(92dvh,760px)] w-full flex-col bg-paper text-ink shadow-panel focus:outline-none",
            variant === "sheet"
              ? "inset-x-0 bottom-0 rounded-t-3xl border-t border-line md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border"
              : "left-1/2 top-1/2 w-[min(100%-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line",
          )}
          onInteractOutside={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="flex items-start justify-between gap-3 px-4 pt-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-2xl font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            {dismissible ? (
              <Dialog.Close className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink" aria-label="Close">
                <X className="size-5" />
              </Dialog.Close>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footer ? <div className="safe-bottom border-t border-line px-4 py-3">{footer}</div> : <div className="safe-bottom" />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

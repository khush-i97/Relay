import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 text-chili-deep", className)} aria-hidden="true">
      <circle cx="14" cy="16" r="10" fill="currentColor" />
      <path d="M18 7.5 28 13.5 19.5 16.5Z" className="fill-paper" />
    </svg>
  );
}

import { cn } from "cnfast";

/** A pulsing placeholder block. Compose these to mirror a page's layout. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted/60", className)} />
  );
}

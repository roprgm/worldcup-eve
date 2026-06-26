import { cn } from "cnfast";

/**
 * A placeholder block. Compose these to mirror a page's layout. The pulse comes
 * from a single `animate-pulse` on the skeleton's root container, not per block:
 * animating hundreds of elements individually is what made the predictions
 * skeleton slow to paint on throttled devices.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-muted/60", className)} />;
}

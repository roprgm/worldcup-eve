import { cn } from "cnfast";

// Static block; the pulse comes from an `animate-pulse` on the skeleton root.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-muted/60", className)} />;
}

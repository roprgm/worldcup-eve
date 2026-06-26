import { cn } from "cnfast";

import { Skeleton } from "@/components/ui/skeleton";

// Card-level loading placeholders shared by the connected widgets. Wrap a grid
// of these in `animate-pulse` so one animation drives them all.

const GROUP_ROWS = ["a", "b", "c", "d"];
const MATCH_ROWS = ["a", "b"];

function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      {children}
    </div>
  );
}

export function GroupCardSkeleton() {
  return (
    <CardFrame>
      <div className="border-b border-surface-divider px-3 py-1.5">
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="space-y-2.5 px-3 py-2.5">
        {GROUP_ROWS.map((row) => (
          <Skeleton key={row} className="h-3 w-full" />
        ))}
      </div>
    </CardFrame>
  );
}

function MatchSideSkeleton({ align }: { align: "start" | "end" }) {
  return (
    <div
      className={cn(
        "space-y-2.5 px-3 py-2.5",
        align === "end" && "border-l border-surface-border",
      )}
    >
      <Skeleton className={cn("h-3.5 w-14", align === "end" && "ml-auto")} />
      {MATCH_ROWS.map((row) => (
        <Skeleton key={row} className="h-2.5 w-full" />
      ))}
    </div>
  );
}

export function MatchCardSkeleton() {
  return (
    <CardFrame>
      <div className="flex items-center justify-between border-b border-surface-divider px-3 py-1.5">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-10" />
      </div>
      <div className="grid grid-cols-2">
        <MatchSideSkeleton align="start" />
        <MatchSideSkeleton align="end" />
      </div>
    </CardFrame>
  );
}

export function ChampionCardSkeleton() {
  return (
    <div className="mb-4 flex flex-col items-center gap-2 pt-2">
      <span className="h-4 w-px bg-border" />
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-pick/40 bg-card px-6 py-3 ring-1 ring-pick/10">
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-3 w-36" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-[15px] w-5 rounded-sm" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

import { cn } from "cnfast";
import type { ReactNode } from "react";

import {
  CardGrid,
  CardGridFrame,
} from "@/app/predictions/components/card-grid";
import { Skeleton } from "@/app/predictions/components/skeleton";
import {
  finalMatch,
  roundMatches,
  thirdPlaceMatch,
} from "@/app/predictions/bracket";
import type { KnockoutMatch } from "@/lib/tournament";

// The tournament has 12 groups (A–L); the letters double as stable keys.
const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const GROUP_ROWS = ["a", "b", "c", "d"];
const MATCH_ROWS = ["a", "b"];

// Mirrors the funnel's section order so the skeleton roughly matches the layout.
const MATCH_SECTIONS = [
  { key: "R32", matches: roundMatches("R32") },
  { key: "R16", matches: roundMatches("R16") },
  { key: "QF", matches: roundMatches("QF") },
  { key: "SF", matches: roundMatches("SF") },
  { key: "FINAL", matches: [thirdPlaceMatch, finalMatch] },
];

function SkeletonSectionHeader() {
  return (
    <CardGridFrame className="sticky top-0 z-20">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 bg-background/90 pt-3 pb-2 backdrop-blur">
        <span className="h-px bg-border" />
        <Skeleton className="h-4 w-24 rounded-sm" />
        <span className="h-px bg-border" />
      </div>
    </CardGridFrame>
  );
}

function SkeletonSection({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-2">
      <SkeletonSectionHeader />
      {children}
    </section>
  );
}

function SkeletonCardFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      {children}
    </div>
  );
}

function SkeletonGroupCard() {
  return (
    <SkeletonCardFrame>
      <div className="border-b border-surface-divider px-3 py-1.5">
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="space-y-2.5 px-3 py-2.5">
        {GROUP_ROWS.map((row) => (
          <Skeleton key={row} className="h-3 w-full" />
        ))}
      </div>
    </SkeletonCardFrame>
  );
}

function SkeletonMatchSide({ align }: { align: "start" | "end" }) {
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

function SkeletonMatchCard() {
  return (
    <SkeletonCardFrame>
      <div className="flex items-center justify-between border-b border-surface-divider px-3 py-1.5">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-10" />
      </div>
      <div className="grid grid-cols-2">
        <SkeletonMatchSide align="start" />
        <SkeletonMatchSide align="end" />
      </div>
    </SkeletonCardFrame>
  );
}

function SkeletonGroups() {
  return (
    <SkeletonSection>
      <CardGrid>
        {GROUPS.map((group) => (
          <SkeletonGroupCard key={group} />
        ))}
      </CardGrid>
    </SkeletonSection>
  );
}

function SkeletonMatches({ matches }: { matches: KnockoutMatch[] }) {
  return (
    <SkeletonSection>
      <CardGrid>
        {matches.map((match) => (
          <SkeletonMatchCard key={match.number} />
        ))}
      </CardGrid>
    </SkeletonSection>
  );
}

function SkeletonChampion() {
  return (
    <SkeletonSection>
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
    </SkeletonSection>
  );
}

// One `animate-pulse` on the root drives every block — much cheaper to paint
// than animating each one.
export function PredictionsSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      <SkeletonGroups />
      {MATCH_SECTIONS.map((section) => (
        <SkeletonMatches key={section.key} matches={section.matches} />
      ))}
      <SkeletonChampion />
    </div>
  );
}

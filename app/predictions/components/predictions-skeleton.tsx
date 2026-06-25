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
import { groupGridColumns } from "@/components/widgets/group-card";
import type { KnockoutMatch, Round, SlotRef } from "@/lib/tournament";

const GROUP_TEAMS = 4;
const GROUP_COUNT = 12;
// Matches GroupCard's ResultCell box: py-1.5 (12px) + leading-none 11px text.
const GROUP_RESULT_ROW_HEIGHT = "h-[23px]";
const GROUP_SLOT_ROWS = 4;
const MAX_SLOT_ROWS = 8;

const MATCH_SECTIONS: KnockoutMatch[][] = [
  roundMatches("R32"),
  roundMatches("R16"),
  roundMatches("QF"),
  roundMatches("SF"),
  [thirdPlaceMatch, finalMatch],
];

function slotSkeletonRows(ref: SlotRef, round: Round): number {
  return round === "R32" && (ref.kind === "winner" || ref.kind === "runner")
    ? GROUP_SLOT_ROWS
    : MAX_SLOT_ROWS;
}

function SkeletonGroupCard() {
  const columns = [0, 1, 2, 3];
  const rows = [0, 1, 2, 3];

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-surface-divider px-3 py-1.5 text-[11px] tracking-wide">
        <Skeleton className="inline-block h-3 w-20 align-middle" />
      </div>
      <div
        className="grid items-center gap-x-1 gap-y-1 px-1.5 py-2"
        style={{
          gridTemplateColumns: groupGridColumns(GROUP_TEAMS),
        }}
      >
        <span />
        {columns.map((i) => (
          <Skeleton key={`head-${i}`} className="mx-auto h-4 w-7" />
        ))}
        <Skeleton className="mx-auto h-4 w-5" />
        <Skeleton className="mx-auto h-4 w-5" />
        <span />

        {rows.flatMap((row) => [
          <div
            key={`${row}:team`}
            className={cn(
              GROUP_RESULT_ROW_HEIGHT,
              "flex items-center gap-1.5 pr-1",
            )}
          >
            <Skeleton className="h-3 w-3 shrink-0" />
            <Skeleton className="h-3 w-4 shrink-0 rounded-sm" />
            <Skeleton className="h-3 w-7 shrink-0" />
          </div>,
          ...columns.map((column) => (
            <span
              key={`${row}:${column}`}
              className={cn(GROUP_RESULT_ROW_HEIGHT, "flex items-center")}
            >
              <Skeleton className="mx-auto h-3 w-full" />
            </span>
          )),
          <span
            key={`${row}:gd`}
            className={cn(
              GROUP_RESULT_ROW_HEIGHT,
              "flex items-center justify-center",
            )}
          >
            <Skeleton className="h-3 w-5" />
          </span>,
          <span
            key={`${row}:pts`}
            className={cn(
              GROUP_RESULT_ROW_HEIGHT,
              "flex items-center justify-center",
            )}
          >
            <Skeleton className="h-3 w-4" />
          </span>,
          <span
            key={`${row}:marker`}
            className={cn(
              GROUP_RESULT_ROW_HEIGHT,
              "flex items-center justify-center",
            )}
          >
            <Skeleton className="size-3 rounded-full" />
          </span>,
        ])}
      </div>
    </div>
  );
}

function SkeletonGroups() {
  return (
    <SkeletonSection>
      <CardGrid>
        {Array.from({ length: GROUP_COUNT }, (_, i) => (
          <SkeletonGroupCard key={i} />
        ))}
      </CardGrid>
    </SkeletonSection>
  );
}

function SkeletonSide({ side, rows }: { side: "home" | "away"; rows: number }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-3 py-2",
        side === "away" && "border-l border-surface-border",
      )}
    >
      <Skeleton className={cn("h-4 w-14", side === "away" && "self-end")} />
      <div className="min-h-[92px] space-y-1">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={cn(
              "flex h-5 items-center gap-1.5",
              side === "away" && "flex-row-reverse",
            )}
          >
            <Skeleton className="size-3.5 shrink-0 rounded-sm" />
            <Skeleton className="h-3 w-8 shrink-0" />
            <Skeleton className="h-2 flex-1" />
            <Skeleton className="h-3 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonCard({ match }: { match: KnockoutMatch }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-surface-divider px-3 py-1.5 text-[11px] tracking-wide">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto h-4 w-24" />
      </div>
      <div className="grid flex-1 grid-cols-2">
        <SkeletonSide
          side="home"
          rows={slotSkeletonRows(match.home, match.round)}
        />
        <SkeletonSide
          side="away"
          rows={slotSkeletonRows(match.away, match.round)}
        />
      </div>
    </div>
  );
}

function SkeletonSectionHeader() {
  return (
    <CardGridFrame className="sticky top-0 z-20">
      <div className="relative grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 bg-background/90 pt-3 pb-2 backdrop-blur">
        <span className="h-px bg-border" />
        <span className="rounded-sm px-2">
          <Skeleton className="h-4 w-24" />
        </span>
        <span className="mr-8 h-px bg-border" />
        <Skeleton className="absolute right-1 size-3 rounded-sm" />
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

function SkeletonMatches({ matches }: { matches: KnockoutMatch[] }) {
  return (
    <SkeletonSection>
      <CardGrid>
        {matches.map((match) => (
          <SkeletonCard key={match.number} match={match} />
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
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-1">
                <Skeleton className="h-[9px] w-3 rounded-sm" />
                <Skeleton className="h-3 w-7" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonSection>
  );
}

/** Full-page placeholder for the predictions funnel while market data loads. */
export function PredictionsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <SkeletonGroups />
      {MATCH_SECTIONS.map((matches, index) => (
        <SkeletonMatches key={index} matches={matches} />
      ))}
      <SkeletonChampion />
    </div>
  );
}

"use client";

import { cn } from "cnfast";
import { Info, Trophy } from "lucide-react";
import { useState } from "react";

import { Flag } from "@/components/flags";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_OPPONENTS = 3;
const MIN_PROBABILITY = 0.01;
const SKELETON_STEPS = ["a", "b", "c", "d", "e"];

interface Opponent {
  code: string;
  name: string;
  probability: number;
}

export interface PathStepView {
  roundLabel: string;
  /** The most likely stadium for this round — always known from the fixture. */
  venue?: string;
  opponents: Opponent[];
}

interface TeamPathCardProps {
  team?: { code: string; name: string };
  /** Header line under the team name. */
  subtitle?: string;
  /** When set, a tappable (i) by the subtitle reveals this note (group-finish). */
  hint?: string;
  /** `undefined` while the predictions load — the card shows skeleton steps. */
  steps?: PathStepView[];
  /** When set, the team has no path (eliminated): shown instead of steps. */
  note?: string;
}

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

// Collapsed: the top few above a floor (always keeping the leader). Expanded:
// every opponent the model gives (already all > 0%).
function visibleOpponents(list: Opponent[], all: boolean): Opponent[] {
  if (all) return list;
  return list
    .filter((o, i) => i === 0 || o.probability >= MIN_PROBABILITY)
    .slice(0, MAX_OPPONENTS);
}

// A compact opponent row — flag, code, probability bar, chance. The pick accent
// is reserved for a near-certain (>99%) opponent, not just the most likely one.
function OpponentRow({ opponent }: { opponent: Opponent }) {
  const certain = opponent.probability > 0.99;
  const width = formatPct(opponent.probability);
  return (
    <div title={opponent.name} className="flex h-4 items-center gap-1.5">
      <Flag code={opponent.code} size={12} />
      <span className="w-7 shrink-0 text-[11px] font-semibold tracking-wide text-foreground/85">
        {opponent.code}
      </span>
      <span className="flex h-1.5 flex-1 overflow-hidden rounded-[1px] bg-muted/50">
        <span
          className={cn(
            "h-full rounded-[1px]",
            certain ? "bg-pick" : "bg-muted-foreground/40",
          )}
          style={{ width }}
        />
      </span>
      <span
        className={cn(
          "min-w-8 text-right text-[11px] tabular-nums",
          certain ? "font-semibold text-pick" : "text-muted-foreground",
        )}
      >
        {width}
      </span>
    </div>
  );
}

function Step({
  step,
  last,
  showAll,
}: {
  step: PathStepView;
  last: boolean;
  showAll: boolean;
}) {
  const opponents = visibleOpponents(step.opponents, showAll);
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-2">
      <div className="flex flex-col items-center">
        <span className="mt-1 size-2 shrink-0 rounded-full bg-pick/70 ring-2 ring-pick/15" />
        {!last && <span className="my-1 w-px flex-1 bg-surface-border" />}
      </div>
      <div className="pb-2">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] font-medium tracking-wide text-muted-foreground/75 uppercase">
          <span>{step.roundLabel}</span>
          {step.venue && (
            <span className="font-normal tracking-normal text-muted-foreground/55 normal-case">
              {step.venue}
            </span>
          )}
        </p>
        {opponents.length === 0 ? (
          <p className="mt-1 text-[12px] text-muted-foreground/40 italic">
            to be decided
          </p>
        ) : (
          <div className="mt-1 space-y-px">
            {opponents.map((opponent) => (
              <OpponentRow key={opponent.code} opponent={opponent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepsSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      {SKELETON_STEPS.map((step, i) => (
        <div key={step} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2">
          <div className="flex flex-col items-center">
            <span className="mt-1 size-2 shrink-0 rounded-full bg-muted" />
            {i < SKELETON_STEPS.length - 1 && (
              <span className="my-1 w-px flex-1 bg-surface-border" />
            )}
          </div>
          <div className="pb-2.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2 h-2.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardHeader({
  team,
  subtitle,
  hint,
  hintOpen,
  onToggleHint,
  hasMore,
  showAll,
  onToggleAll,
}: {
  team?: { code: string; name: string };
  subtitle?: string;
  hint?: string;
  hintOpen: boolean;
  onToggleHint: () => void;
  hasMore: boolean;
  showAll: boolean;
  onToggleAll: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-surface-divider px-3 py-2">
      <Flag code={team?.code} size={20} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {team?.name ?? "—"}
        </p>
        <p className="flex flex-wrap items-center gap-x-1 text-[11px] text-muted-foreground">
          <span>{subtitle ?? "Most likely opponents to the final"}</span>
          {hint && (
            <button
              type="button"
              onClick={onToggleHint}
              aria-expanded={hintOpen}
              aria-label="Why these chances can change"
              className="inline-flex shrink-0 rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Info className="size-3" />
            </button>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={onToggleAll}
              aria-expanded={showAll}
              className="shrink-0 font-medium text-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              · {showAll ? "See fewer" : "See all"}
            </button>
          )}
        </p>
      </div>
      <Trophy className="ml-auto size-4 text-pick" />
    </div>
  );
}

/** A team's projected knockout route — likely opponents each round from the
 *  Round of 32 to the final. Steps are `undefined` while the market loads; a
 *  `note` replaces them when the team is out. When the chances hinge on the
 *  group result, a tappable (i) by the subtitle reveals `hint`. */
export function TeamPathCard({
  team,
  subtitle,
  hint,
  steps,
  note,
}: TeamPathCardProps) {
  const [hintOpen, setHintOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const hasMore = (steps ?? []).some(
    (s) => s.opponents.length > visibleOpponents(s.opponents, false).length,
  );

  // "out" keeps its fixed subtitle; the path subtitle tracks the toggle, since
  // expanded we're showing every possible opponent, not just the likeliest.
  const headerSubtitle =
    note !== undefined
      ? subtitle
      : showAll
        ? "All possible opponents to the final"
        : "Most likely opponents to the final";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <CardHeader
        team={team}
        subtitle={headerSubtitle}
        hint={hint}
        hintOpen={hintOpen}
        onToggleHint={() => setHintOpen((open) => !open)}
        hasMore={hasMore}
        showAll={showAll}
        onToggleAll={() => setShowAll((open) => !open)}
      />
      {hint && hintOpen && (
        <p className="border-b border-surface-divider bg-muted/30 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="px-3 pt-3">
        {note !== undefined ? (
          <p className="pb-3 text-[13px] text-muted-foreground">{note}</p>
        ) : steps === undefined ? (
          <StepsSkeleton />
        ) : (
          steps.map((step, i) => (
            <Step
              key={step.roundLabel}
              step={step}
              last={i === steps.length - 1}
              showAll={showAll}
            />
          ))
        )}
      </div>
    </div>
  );
}

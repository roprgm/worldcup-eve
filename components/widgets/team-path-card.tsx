"use client";

import { cn } from "cnfast";
import { Info, Trophy } from "lucide-react";
import { useState } from "react";

import { Flag } from "@/components/flags";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_OPPONENTS = 6;
const MIN_PROBABILITY = 0.01;
const SKELETON_STEPS = ["a", "b", "c", "d", "e"];

interface Opponent {
  code: string;
  name: string;
  probability: number;
}

export interface PathStepView {
  roundLabel: string;
  reachProbability: number;
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

function shownOpponents(list: Opponent[]): Opponent[] {
  return list
    .filter((o, i) => i === 0 || o.probability >= MIN_PROBABILITY)
    .slice(0, MAX_OPPONENTS);
}

// A compact opponent chip — flag, code, chance — so several wrap per row.
function OpponentChip({
  opponent,
  lead,
}: {
  opponent: Opponent;
  lead: boolean;
}) {
  return (
    <div
      title={opponent.name}
      className={cn(
        "flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        lead ? "border-pick/40 bg-pick/5" : "border-surface-border bg-muted/30",
      )}
    >
      <Flag code={opponent.code} size={12} />
      <span
        className={cn(
          "text-[11px] font-semibold tracking-wide",
          lead ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {opponent.code}
      </span>
      <span
        className={cn(
          "text-[11px] tabular-nums",
          lead ? "font-semibold text-pick" : "text-muted-foreground/70",
        )}
      >
        {formatPct(opponent.probability)}
      </span>
    </div>
  );
}

function Step({ step, last }: { step: PathStepView; last: boolean }) {
  const opponents = shownOpponents(step.opponents);
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-2">
      <div className="flex flex-col items-center">
        <span className="mt-1 size-2 shrink-0 rounded-full bg-pick/70 ring-2 ring-pick/15" />
        {!last && <span className="my-1 w-px flex-1 bg-surface-border" />}
      </div>
      <div className="pb-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground/75 uppercase">
            {step.roundLabel}
          </p>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            reach {formatPct(step.reachProbability)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {opponents.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/40 italic">
              to be decided
            </p>
          ) : (
            opponents.map((opponent, i) => (
              <OpponentChip
                key={opponent.code}
                opponent={opponent}
                lead={i === 0}
              />
            ))
          )}
        </div>
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
}: {
  team?: { code: string; name: string };
  subtitle?: string;
  hint?: string;
  hintOpen: boolean;
  onToggleHint: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-surface-divider px-3 py-2">
      <Flag code={team?.code} size={20} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {team?.name ?? "—"}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="truncate">{subtitle ?? "Road to the final"}</span>
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
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <CardHeader
        team={team}
        subtitle={subtitle}
        hint={hint}
        hintOpen={hintOpen}
        onToggleHint={() => setHintOpen((open) => !open)}
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
            />
          ))
        )}
      </div>
    </div>
  );
}

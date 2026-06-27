import { cn } from "cnfast";
import { Trophy } from "lucide-react";

import { Flag } from "@/components/flags";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_OPPONENTS = 4;
const MIN_PROBABILITY = 0.01;
const SKELETON_STEPS = ["a", "b", "c", "d", "e"];

interface Opponent {
  code: string;
  name: string;
  probability: number;
}

export interface PathStepView {
  roundLabel: string;
  matchNumber: number;
  opponents: Opponent[];
}

interface TeamPathCardProps {
  team?: { code: string; name: string };
  placementLabel?: string;
  /** `undefined` while the predictions load — the card shows skeleton steps. */
  steps?: PathStepView[];
}

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function shownOpponents(list: Opponent[]): Opponent[] {
  return list
    .filter((o, i) => i === 0 || o.probability >= MIN_PROBABILITY)
    .slice(0, MAX_OPPONENTS);
}

function OpponentRow({
  opponent,
  lead,
}: {
  opponent: Opponent;
  lead: boolean;
}) {
  return (
    <div className="flex h-5 items-center gap-1.5">
      <Flag code={opponent.code} size={14} />
      <span
        title={opponent.name}
        className={cn(
          "w-8 shrink-0 text-[12px] font-semibold tracking-wide",
          lead ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {opponent.code}
      </span>
      <span className="flex h-2 flex-1 overflow-hidden rounded-[1px] bg-muted/50">
        <span
          className={cn(
            "h-full rounded-[1px]",
            lead ? "bg-pick" : "bg-muted-foreground/30",
          )}
          style={{ width: formatPct(opponent.probability) }}
        />
      </span>
      <span
        className={cn(
          "min-w-10 text-right text-[12px] tabular-nums",
          lead ? "font-semibold text-foreground" : "text-muted-foreground",
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
      <div className="pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground/75 uppercase">
            {step.roundLabel}
          </p>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            #{step.matchNumber}
          </span>
        </div>
        <div className="mt-1 space-y-1">
          {opponents.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/40 italic">
              no market
            </p>
          ) : (
            opponents.map((opponent, i) => (
              <OpponentRow
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
          <div className="pb-3">
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
  placementLabel,
}: {
  team?: { code: string; name: string };
  placementLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-surface-divider px-3 py-2">
      <Flag code={team?.code} size={20} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {team?.name ?? "—"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Road to the final{placementLabel ? ` · ${placementLabel}` : ""}
        </p>
      </div>
      <Trophy className="ml-auto size-4 text-pick" />
    </div>
  );
}

/** A team's projected knockout route — likely opponents at each round from the
 *  Round of 32 to the final. Steps are `undefined` while the market loads. */
export function TeamPathCard({
  team,
  placementLabel,
  steps,
}: TeamPathCardProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <CardHeader team={team} placementLabel={placementLabel} />
      <div className="px-3 pt-3">
        {steps === undefined ? (
          <StepsSkeleton />
        ) : (
          steps.map((step, i) => (
            <Step
              key={step.matchNumber}
              step={step}
              last={i === steps.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

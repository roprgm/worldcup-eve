import { cn } from "cnfast";
import { GitFork, Trophy } from "lucide-react";

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
  opponents: Opponent[];
}

export interface PathBranchView {
  /** Shown above the steps when the path forks, e.g. "If they win Group J". */
  title?: string;
  /** Right-aligned chance of taking this branch, e.g. "45%". */
  chance?: string;
  steps: PathStepView[];
}

interface TeamPathCardProps {
  team?: { code: string; name: string };
  /** Header line under the team name. */
  subtitle?: string;
  /** `undefined` while the predictions load — the card shows skeleton steps. */
  branches?: PathBranchView[];
  /** When set, the team has no path (eliminated): shown instead of branches. */
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
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground/75 uppercase">
          {step.roundLabel}
        </p>
        <div className="mt-1 space-y-1">
          {opponents.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/40 italic">
              to be decided
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

function Branch({
  branch,
  showTitle,
}: {
  branch: PathBranchView;
  showTitle: boolean;
}) {
  return (
    <div>
      {showTitle && branch.title && (
        <div className="mb-2 flex items-center gap-1.5">
          <GitFork className="size-3 text-pick/70" />
          <span className="text-[12px] font-semibold text-foreground">
            {branch.title}
          </span>
          {branch.chance && (
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {branch.chance}
            </span>
          )}
        </div>
      )}
      {branch.steps.map((step, i) => (
        <Step
          key={step.roundLabel}
          step={step}
          last={i === branch.steps.length - 1}
        />
      ))}
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
  subtitle,
}: {
  team?: { code: string; name: string };
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-surface-divider px-3 py-2">
      <Flag code={team?.code} size={20} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {team?.name ?? "—"}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {subtitle ?? "Road to the final"}
        </p>
      </div>
      <Trophy className="ml-auto size-4 text-pick" />
    </div>
  );
}

/** A team's projected knockout route — likely opponents each round from the
 *  Round of 32 to the final. When the group is undecided the path forks, so the
 *  body stacks one labeled branch per possible finish. `branches` is `undefined`
 *  while the market loads; a `note` replaces them when the team is out. */
export function TeamPathCard({
  team,
  subtitle,
  branches,
  note,
}: TeamPathCardProps) {
  const forked = (branches?.length ?? 0) > 1;
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <CardHeader team={team} subtitle={subtitle} />
      <div className="px-3 pt-3">
        {note !== undefined ? (
          <p className="pb-3 text-[13px] text-muted-foreground">{note}</p>
        ) : branches === undefined ? (
          <StepsSkeleton />
        ) : (
          branches.map((branch, i) => (
            <div
              key={branch.title ?? i}
              className={cn(
                i > 0 && "mt-1 border-t border-surface-divider pt-3",
              )}
            >
              <Branch branch={branch} showTitle={forked} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

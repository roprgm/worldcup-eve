import { cn } from "cnfast";
import { AlertTriangle } from "lucide-react";

import { Flag } from "@/components/flags";
import { Section } from "@/components/ui/section";
import { playedWinners } from "@/lib/arena/board";
import type { Score } from "@/lib/arena/score";
import type { AskedQuestion } from "@/lib/arena/bracket";
import type { ArenaRunView } from "@/lib/arena/types";
import type { Results } from "@/lib/results";
import type { Round } from "@/lib/tournament";

const ROUND_LABEL: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  TP: "Third place",
  FINAL: "Final",
};

const ROUND_ORDER: Round[] = ["R32", "R16", "QF", "SF", "FINAL"];

const formatDuration = (ms: number) =>
  ms >= 60_000
    ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
    : `${(ms / 1000).toFixed(1)}s`;

// Compact token counts: 62003 → "62k", 2612 → "2.6k".
const compactTokens = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatTokens = (n: number) => compactTokens.format(n).toLowerCase();

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function TeamChip({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Flag code={code} size={16} />
      <span className="text-sm font-medium">{code}</span>
    </span>
  );
}

/** One asked question: the matchup, the model's pick with its short reasoning,
 *  and — once the match is played — whether the pick was right. */
function QuestionRow({ q, actual }: { q: AskedQuestion; actual?: string }) {
  const decided = actual !== undefined;
  const correct = decided && actual === q.pick;
  return (
    <li className="py-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <TeamChip
            code={q.home}
            className={
              q.pick === q.home ? "text-foreground" : "text-muted-foreground"
            }
          />
          <span className="text-sm text-muted-foreground/60">vs</span>
          <TeamChip
            code={q.away}
            className={
              q.pick === q.away ? "text-foreground" : "text-muted-foreground"
            }
          />
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium",
            !decided && "bg-surface-2 text-muted-foreground",
            correct && "bg-pick/15 text-pick",
            decided && !correct && "bg-red-500/15 text-red-400",
          )}
          title={
            decided
              ? correct
                ? "Correct"
                : `Wrong — ${actual} won`
              : "Not played yet"
          }
        >
          <Flag code={q.pick} size={14} />
          {q.pick}
        </span>
      </div>
      {q.reasoning && (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {q.reasoning}
        </p>
      )}
    </li>
  );
}

function PicksByRound({
  questions,
  results,
}: {
  questions: AskedQuestion[];
  results: Results;
}) {
  const actual = playedWinners(results);
  return (
    <div className="space-y-4">
      {ROUND_ORDER.map((round) => {
        const rows = questions.filter((q) => q.round === round);
        if (rows.length === 0) return null;
        return (
          <div key={round}>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {ROUND_LABEL[round]}
            </h3>
            <ul className="divide-y divide-surface-border">
              {rows.map((q) => (
                <QuestionRow key={q.match} q={q} actual={actual[q.match]} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** The run's stats card: the model id and how it did. Sits below the bracket.
 *  The conversation, reasoning and thinking live on a separate debug view. */
export function RunMeta({ run, score }: { run: ArenaRunView; score: Score }) {
  return (
    <div className="rounded-lg border border-surface-border bg-card p-4">
      <code className="text-xs text-muted-foreground">{run.model}</code>
      {run.error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="size-3.5 shrink-0" />
          {run.error}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetaStat label="points" value={String(score.points)} />
        <MetaStat label="correct" value={`${score.correct}/${score.decided}`} />
        <MetaStat label="picks" value={String(run.questions.length)} />
        <MetaStat label="champion" value={run.champion ?? "—"} />
        <MetaStat label="tokens" value={formatTokens(run.usage.totalTokens)} />
        <MetaStat
          label="in / out"
          value={`${formatTokens(run.usage.inputTokens)} / ${formatTokens(run.usage.outputTokens)}`}
        />
        <MetaStat label="duration" value={formatDuration(run.durationMs)} />
      </div>
    </div>
  );
}

/** The per-pick breakdown, shown below the bracket. Reasoning only appears for
 *  the questions that carry it (model runs), so a human bracket just lists the
 *  picks. */
export function RunPicks({
  questions,
  results,
}: {
  questions: AskedQuestion[];
  results: Results;
}) {
  if (questions.length === 0) return null;
  return (
    <Section title="Picks">
      <div className="pt-1">
        <PicksByRound questions={questions} results={results} />
      </div>
    </Section>
  );
}

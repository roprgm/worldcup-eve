import { AlertTriangle, Trophy } from "lucide-react";
import Link from "next/link";

import { Flag } from "@/components/flags";
import { LocalTime } from "@/components/ui/local-time";
import { type Score, scoreRun } from "@/lib/arena/score";
import type { ArenaRunSummary } from "@/lib/arena/types";
import type { Results } from "@/lib/results";
import { teamById } from "@/lib/tournament";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const formatDuration = (ms: number) =>
  ms >= 60_000
    ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
    : `${(ms / 1000).toFixed(1)}s`;

const accuracy = (s: Score) =>
  s.decided > 0 ? `${Math.round((s.correct / s.decided) * 100)}%` : "—";

function ChampionCell({ code }: { code?: string }) {
  if (!code) return <span className="text-sm text-muted-foreground/50">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag code={code} size={18} />
      <span className="text-sm font-medium text-foreground">{code}</span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {teamById[code]?.name}
      </span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-sm tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function RunRow({
  run,
  rank,
  score,
}: {
  run: ArenaRunSummary;
  rank: number;
  score: Score;
}) {
  return (
    <Link
      href={`/arena/${run.id}`}
      className="group flex items-center gap-3 rounded-lg border border-surface-border bg-card px-3 py-3 transition-colors hover:border-border-strong hover:bg-surface-2 sm:gap-4 sm:px-4"
    >
      <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground">
            {run.label}
          </span>
          {run.error && (
            <AlertTriangle
              className="size-3.5 shrink-0 text-amber-400"
              aria-label="Run finished with an error"
            />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ChampionCell code={run.champion} />
        </div>
      </div>
      <Stat label="pts" value={String(score.points)} />
      <div className="hidden sm:block">
        <Stat label="correct" value={`${score.correct}/${score.decided}`} />
      </div>
      <div className="hidden sm:block">
        <Stat label="acc" value={accuracy(score)} />
      </div>
      <div className="hidden md:block">
        <Stat label="tokens" value={run.usage.totalTokens.toLocaleString()} />
      </div>
      <div className="hidden text-right md:block">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-sm tabular-nums text-foreground">
            {formatDuration(run.durationMs)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <LocalTime iso={run.createdAt}>
              {formatDate(run.createdAt)}
            </LocalTime>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** The arena leaderboard: every stored run ranked by the points it has earned
 *  against the results so far, then by how many picks it got right. */
export function RunList({
  runs,
  results,
}: {
  runs: ArenaRunSummary[];
  results: Results;
}) {
  if (runs.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-surface-border bg-card px-6 py-16 text-center">
        <Trophy className="mx-auto size-6 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          No runs yet. Populate the arena with{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-foreground">
            bun run arena
          </code>
          .
        </p>
      </div>
    );

  const scored = runs
    .map((run) => ({ run, score: scoreRun(run.picks, results) }))
    .sort(
      (a, b) =>
        b.score.points - a.score.points ||
        b.score.correct - a.score.correct ||
        a.run.durationMs - b.run.durationMs,
    );

  return (
    <div className="flex flex-col gap-2">
      {scored.map(({ run, score }, i) => (
        <RunRow key={run.id} run={run} rank={i + 1} score={score} />
      ))}
    </div>
  );
}

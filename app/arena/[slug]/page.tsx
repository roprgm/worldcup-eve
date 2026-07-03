import { notFound } from "next/navigation";

import { RunMeta, RunPicks } from "@/components/arena/run-detail";
import { type NavNeighbor, RunNav } from "@/components/arena/run-nav";
import { SharedBracket } from "@/components/bracket-builder";
import { rankRuns, scoreRun } from "@/lib/arena/score";
import { readIndex, readRun } from "@/lib/arena/storage";
import { getMatchResults } from "@/lib/results";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const run = await readRun(slug);
  return { title: run ? `${run.label} · WorldCup Arena` : "WorldCup Arena" };
}

const neighbor = (r?: {
  id: string;
  label: string;
}): NavNeighbor | undefined => (r ? { slug: r.id, label: r.label } : undefined);

/** One arena run: a title line (model name + rank, arrows stepping to the
 *  prev/next run), the predicted bracket laid over the live results, the per-pick
 *  breakdown, and the stats card at the bottom. */
export default async function ArenaRunPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [run, results, index] = await Promise.all([
    readRun(slug),
    getMatchResults(),
    readIndex(),
  ]);
  if (!run) notFound();

  // The arrows walk the same order as the leaderboard; the run's own score comes
  // from that ranking when it's in the index, else computed directly.
  const ranked = rankRuns(index, results);
  const pos = ranked.findIndex((r) => r.run.id === run.id);
  const score = pos >= 0 ? ranked[pos].score : scoreRun(run.picks, results);
  const prev = pos > 0 ? ranked[pos - 1].run : undefined;
  const next =
    pos >= 0 && pos < ranked.length - 1 ? ranked[pos + 1].run : undefined;
  const paged = ranked.length > 1 && pos >= 0;

  return (
    <div className="space-y-6">
      <RunNav
        title={run.label}
        rank={paged ? `Rank ${pos + 1} of ${ranked.length}` : ""}
        prev={paged ? neighbor(prev) : undefined}
        next={paged ? neighbor(next) : undefined}
      />
      <div className="arena-run-view mx-auto w-full max-w-lg">
        <SharedBracket results={results} picks={run.picks} />
      </div>
      <RunPicks questions={run.questions} results={results} />
      <RunMeta run={run} score={score} />
    </div>
  );
}

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RunDetail } from "@/components/arena/run-detail";
import { type PagerNeighbor, RunPager } from "@/components/arena/run-pager";
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
}): PagerNeighbor | undefined =>
  r ? { slug: r.id, label: r.label } : undefined;

/** One arena run: the model's predicted bracket laid over the live results, with
 *  its metadata and per-pick scoring. Prev/next steps through the other runs in
 *  leaderboard order, keeping the bracket in place. */
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

  // The pager walks the same order as the leaderboard; the run's own score comes
  // from that ranking when it's in the index, else computed directly.
  const ranked = rankRuns(index, results);
  const pos = ranked.findIndex((r) => r.run.id === run.id);
  const score = pos >= 0 ? ranked[pos].score : scoreRun(run.picks, results);
  const prev = pos > 0 ? ranked[pos - 1].run : undefined;
  const next =
    pos >= 0 && pos < ranked.length - 1 ? ranked[pos + 1].run : undefined;

  return (
    <>
      <Link
        href="/arena"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Arena
      </Link>
      {ranked.length > 1 && pos >= 0 && (
        <div className="mb-4">
          <RunPager
            prev={neighbor(prev)}
            next={neighbor(next)}
            position={`${pos + 1} of ${ranked.length}`}
          />
        </div>
      )}
      <div className="mx-auto w-full max-w-lg">
        <SharedBracket results={results} picks={run.picks} />
      </div>
      <RunDetail run={run} score={score} results={results} />
    </>
  );
}

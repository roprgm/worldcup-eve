import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RunDetail } from "@/components/arena/run-detail";
import { SharedBracket } from "@/components/bracket-builder";
import { scoreRun } from "@/lib/arena/score";
import { readRun } from "@/lib/arena/storage";
import { getMatchResults } from "@/lib/results";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await readRun(id);
  return { title: run ? `${run.label} · WorldCup Arena` : "WorldCup Arena" };
}

/** One arena run: the model's predicted bracket laid over the live results, with
 *  its metadata, per-pick scoring and the full conversation. */
export default async function ArenaRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await readRun(id);
  if (!run) notFound();
  const results = await getMatchResults();
  const score = scoreRun(run.picks, results);

  return (
    <>
      <Link
        href="/arena"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Arena
      </Link>
      <div className="mx-auto w-full max-w-lg">
        <SharedBracket results={results} picks={run.picks} />
      </div>
      <RunDetail run={run} score={score} results={results} />
    </>
  );
}

import { notFound } from "next/navigation";

import { RunPicks } from "@/components/arena/run-detail";
import { RunNav } from "@/components/arena/run-nav";
import { SharedBracket } from "@/components/bracket-builder";
import { buildBoard } from "@/lib/arena/board";
import { matchupsFromPicks } from "@/lib/arena/bracket";
import { readBracket } from "@/lib/arena/brackets";
import { scoreRun } from "@/lib/arena/score";
import { getMatchResults } from "@/lib/results";

export const metadata = { title: "Shared bracket · WorldCup Arena" };

export const dynamic = "force-dynamic";

/** A shared human bracket: the picks laid over the live results, scored, with a
 *  per-pick breakdown — the same view a model run gets, minus the reasoning and
 *  the model metadata. Read-only; not part of the leaderboard. */
export default async function SharedBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bracket = await readBracket(id);
  if (!bracket) notFound();
  const { name, picks } = bracket;
  const results = await getMatchResults();
  const board = buildBoard(results);
  // A human bracket only stores the picks the user actively made; matches already
  // resolved when they built it are pinned to reality and never get written into
  // `picks`. Fill those in from the board so the shared view shows a complete
  // bracket instead of empty nodes. A resolved match implies its feeders are
  // resolved too, so the filled sides stay consistent; an actual user pick always
  // wins over the board.
  const fullPicks = { ...board.winners, ...picks };
  const questions = matchupsFromPicks(board, fullPicks);
  const score = scoreRun(fullPicks, results);

  return (
    <div className="space-y-6">
      <RunNav title={name ? `${name}’s bracket` : "Shared bracket"} />
      <div className="mx-auto w-full max-w-lg">
        <SharedBracket results={results} picks={fullPicks} />
      </div>
      <p className="text-center text-sm tabular-nums text-muted-foreground">
        {score.points} points · {score.correct}/{score.decided} correct
      </p>
      <RunPicks questions={questions} results={results} />
    </div>
  );
}

"use client";

import { GroupCard } from "@/components/widgets/group-card";
import { usePredictions, useResults } from "@/components/widgets/queries";
import type { GroupOdds } from "@/lib/predictions";
import type { MatchStatus, Results } from "@/lib/results";
import { type GroupLetter, groupMatches, teamById } from "@/lib/tournament";
import { computeStandings, type Scores } from "@/lib/tournament/standings";

// Match the bracket's threshold: a market this lopsided is treated as decided.
const QUALIFIED = 0.999;

type GroupFixture = (typeof groupMatches)[number];
type ResultStatus = "live" | "final" | "predicted";

/** Per-fixture scoreline: a real result if the match has been played, else the
 *  market's most-likely exact score. */
function resultsFor(
  letter: GroupLetter,
  predicted: Scores,
  real: Scores,
): Scores {
  const results: Scores = {};
  for (const m of groupMatches) {
    if (m.group !== letter) continue;
    const known = real[m.id] ?? predicted[m.id];
    if (known) results[m.id] = known;
  }
  return results;
}

function resultStatus(status: MatchStatus | undefined): ResultStatus {
  if (status === "live" || status === "final") return status;
  return "predicted";
}

function resultFor({
  match,
  rowTeam,
  results,
  status,
}: {
  match: GroupFixture;
  rowTeam: string;
  results: Scores;
  status: Record<string, MatchStatus>;
}) {
  const score = results[match.id];
  const rowIsHome = match.homeId === rowTeam;
  const rowGoals = rowIsHome ? score.h : score.a;
  const columnGoals = rowIsHome ? score.a : score.h;
  const columnTeam = rowIsHome ? match.awayId : match.homeId;
  const state = resultStatus(status[match.id]);

  return {
    text: `${rowGoals}–${columnGoals}`,
    title: `${teamById[rowTeam].name} vs ${teamById[columnTeam].name} - ${state}`,
    status: state,
  };
}

function groupRows(group: GroupOdds, predicted: Scores, live: Results) {
  const results = resultsFor(group.letter, predicted, live.groupScores);
  const standings = computeStandings(group.letter, results);
  const columns = standings.map((s) => s.teamId);
  const fixtures = groupMatches.filter((m) => m.group === group.letter);
  const advanceOf = new Map(group.teams.map((t) => [t.code, t.advance]));
  const matchOf = (x: string, y: string) =>
    fixtures.find(
      (m) =>
        (m.homeId === x && m.awayId === y) ||
        (m.homeId === y && m.awayId === x),
    )!;

  const rows = standings.map((standing, index) => {
    const team = teamById[standing.teamId];
    return {
      position: index + 1,
      team: {
        code: team.id,
        name: team.name,
        confirmed: (advanceOf.get(standing.teamId) ?? 0) >= QUALIFIED,
      },
      dimmed: index >= 3,
      goalDiff:
        standing.goalDiff > 0
          ? `+${standing.goalDiff}`
          : String(standing.goalDiff),
      points: standing.points,
      marker: (index < 2 ? "advance" : index === 2 ? "third" : "none") as
        | "advance"
        | "third"
        | "none",
      cells: columns.map((column) =>
        column === standing.teamId
          ? null
          : resultFor({
              match: matchOf(standing.teamId, column),
              rowTeam: standing.teamId,
              results,
              status: live.groupStatus,
            }),
      ),
    };
  });

  return { columns, rows };
}

/** One group's standings table — real scores where played, market predictions
 *  elsewhere. Fetches the shared predictions/results; renders its own skeleton. */
export function PredictionGroupWidget({ letter }: { letter: GroupLetter }) {
  const predictions = usePredictions();
  const results = useResults();

  if (!predictions || !results) {
    return <GroupCard title={`Group ${letter}`} loading />;
  }

  const group = predictions.groups.find((g) => g.letter === letter);
  if (!group) return null;

  const { columns, rows } = groupRows(group, predictions.groupScores, results);
  return <GroupCard title={`Group ${letter}`} columns={columns} rows={rows} />;
}

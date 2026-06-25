import { CardGrid } from "@/app/predictions/components/card-grid";
import { GroupCard } from "@/components/widgets/group-card";
import { groupMatches, teamById } from "@/lib/tournament";
import type { MatchStatus } from "@/lib/results";
import { computeStandings, type Scores } from "@/lib/tournament/standings";
import type { GroupOdds } from "@/lib/predictions";

// Match the bracket's threshold: a market this lopsided is treated as decided.
const QUALIFIED = 0.999;
const EMPTY_GROUP_RESULTS: Scores = {};
const EMPTY_GROUP_STATUS: Record<string, MatchStatus> = {};

interface GroupStageLive {
  groupScores: Scores;
  groupStatus: Record<string, MatchStatus>;
}

interface GroupStageProps {
  groups: GroupOdds[];
  predicted: Scores;
  live?: GroupStageLive;
}

type GroupFixture = (typeof groupMatches)[number];
type ResultStatus = "live" | "final" | "predicted";

/**
 * Per-fixture scoreline: a real result if the match has been played, else the
 * market's most-likely exact score.
 */
function resultsFor(group: GroupOdds, predicted: Scores, real: Scores): Scores {
  const results: Scores = {};
  for (const m of groupMatches) {
    if (m.group !== group.letter) continue;
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

/**
 * Read-only group stage. It receives already-loaded prediction/live data and
 * distributes it into group cards.
 */
export function GroupStage({ groups, predicted, live }: GroupStageProps) {
  const groupScores = live?.groupScores ?? EMPTY_GROUP_RESULTS;
  const groupStatus = live?.groupStatus ?? EMPTY_GROUP_STATUS;

  return (
    <CardGrid>
      {groups.map((group) => {
        const results = resultsFor(group, predicted, groupScores);
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

        return (
          <GroupCard
            key={group.letter}
            title={`Group ${group.letter}`}
            columns={columns}
            rows={standings.map((standing, index) => {
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
                marker: index < 2 ? "advance" : index === 2 ? "third" : "none",
                cells: columns.map((column) =>
                  column === standing.teamId
                    ? null
                    : resultFor({
                        match: matchOf(standing.teamId, column),
                        rowTeam: standing.teamId,
                        results,
                        status: groupStatus,
                      }),
                ),
              };
            })}
          />
        );
      })}
    </CardGrid>
  );
}

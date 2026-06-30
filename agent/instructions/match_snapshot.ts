import { defineDynamic, defineInstructions } from "eve/instructions";

import { tournamentDay } from "@/agent/lib/time";
import { matchSchedule } from "@/lib/tournament";

const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;

const matches = matchSchedule
  .map((match) => ({
    ...match,
    kickoff: new Date(match.kickoffAt),
  }))
  .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

function matchLine(match: (typeof matches)[number]): string {
  return `match ${match.number}: ${match.homeId ?? "TBD"} vs ${match.awayId ?? "TBD"}, tournament_day ${tournamentDay(match.kickoff)}, kickoff UTC ${match.kickoff.toISOString()}, ${match.venue}`;
}

function lines(items: typeof matches): string {
  return items.length ? items.map(matchLine).join("; ") : "none";
}

function sameKickoffAs(
  match: (typeof matches)[number] | undefined,
): typeof matches {
  return match
    ? matches.filter(
        (item) => item.kickoff.getTime() === match.kickoff.getTime(),
      )
    : [];
}

export default defineDynamic({
  events: {
    "turn.started": () => {
      const now = Date.now();
      const past = matches.filter(
        (match) => match.kickoff.getTime() + MATCH_WINDOW_MS <= now,
      );
      const current = matches.filter(
        (match) =>
          match.kickoff.getTime() <= now &&
          match.kickoff.getTime() + MATCH_WINDOW_MS > now,
      );
      const next = matches.find((match) => match.kickoff.getTime() > now);
      const last = past.at(-1);

      return defineInstructions({
        markdown: [
          "# Match Snapshot",
          `Last match: ${lines(sameKickoffAs(last))}.`,
          `Current match: ${lines(current)}.`,
          `Next match: ${lines(sameKickoffAs(next))}.`,
        ].join("\n"),
      });
    },
  },
});

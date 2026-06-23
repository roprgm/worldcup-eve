import { defineDynamic, defineInstructions } from "eve/instructions";

import scheduleData from "@/agent/lib/schedule";
import { tournamentDay } from "@/agent/lib/time";

const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const matches = scheduleData
  .map((match) => ({
    ...match,
    kickoff: new Date(match.kickoffAt),
  }))
  .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

function matchLine(match: (typeof matches)[number], now: number): string {
  const diffMs = match.kickoff.getTime() - now;
  const minutesUntil = Math.max(1, Math.floor(diffMs / MINUTE_MS));
  const relativeTime = diffMs > 0 ? `, starts_in_minutes ${minutesUntil}` : "";
  return `match ${match.number}: ${match.teamA ?? "TBD"} vs ${match.teamB ?? "TBD"}, tournament_day ${tournamentDay(match.kickoff)}, kickoff UTC ${match.kickoff.toISOString()}${relativeTime}, ${match.stadium}`;
}

function lines(items: typeof matches, now: number): string {
  return items.length
    ? items.map((match) => matchLine(match, now)).join("; ")
    : "none";
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
          `Last match: ${lines(sameKickoffAs(last), now)}.`,
          `Current match: ${lines(current, now)}.`,
          `Next match: ${lines(sameKickoffAs(next), now)}.`,
        ].join("\n"),
      });
    },
  },
});

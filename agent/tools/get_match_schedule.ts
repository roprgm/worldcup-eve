import { defineTool } from "eve/tools";
import { z } from "zod";

import { tournamentDay } from "@/agent/lib/time";
import { getPredictions } from "@/lib/predictions";
import { matchSchedule, teamById } from "@/lib/tournament";

// A match is live for two hours from kickoff, then it counts as played.
const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;
// A knockout slot is "decided" once its leading team is all but certain.
const SETTLED = 0.99;

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

const norm = (value: string) => value.trim().toLowerCase();

const involvesTeam = (code: string | null, query: string) => {
  if (!code) return false;
  const q = norm(query);
  return norm(code) === q || norm(teamById[code]?.name ?? "").includes(q);
};

// Knockout fixtures are TBD in the static schedule; resolve the decided ones
// from the prediction slots (same source the forecast uses) so a team's next
// knockout game shows up by name.
async function resolvedKnockoutTeams(): Promise<
  Map<number, { home: string | null; away: string | null }>
> {
  const resolved = new Map<
    number,
    { home: string | null; away: string | null }
  >();
  try {
    const { slots } = await getPredictions();
    const settled = (match: number, side: "home" | "away") => {
      const top = slots.find((s) => s.match === match && s.side === side)
        ?.candidates[0];
      return top && top.probability >= SETTLED ? top.code : null;
    };
    for (const m of matchSchedule) {
      if (m.number <= 72) continue;
      const home = settled(m.number, "home");
      const away = settled(m.number, "away");
      if (home || away) resolved.set(m.number, { home, away });
    }
  } catch {
    // Predictions unavailable — knockout sides stay TBD.
  }
  return resolved;
}

interface Fixture {
  number: number;
  homeId: string | null;
  awayId: string | null;
  kickoffAt: string;
  venue: string;
}

function line(m: Fixture): string {
  const date = m.kickoffAt.slice(0, 10);
  const time = m.kickoffAt.slice(11, 16);
  return `Match ${m.number}: ${teamName(m.homeId)} vs ${teamName(m.awayId)} — ${date} ${time} UTC, ${m.venue}`;
}

export default defineTool({
  description:
    "Match fixtures as text — kickoff times, venues and match numbers, filtered by team or match number. Splits into upcoming and already-played; use it for a team's schedule or to look up a fixture's number/kickoff. To show match cards instead, use show_matches.",
  inputSchema: z.object({
    team: z
      .string()
      .optional()
      .describe("Only matches involving this team (FIFA code or name)."),
    matches: z
      .array(z.number().int())
      .optional()
      .describe("Only these FIFA match numbers (1-104)."),
  }),
  async execute({ team, matches }) {
    const now = Date.now();
    const resolved = await resolvedKnockoutTeams();
    const wanted = matches && new Set(matches);

    const selected: Fixture[] = matchSchedule
      .map((m) => ({
        number: m.number,
        homeId: m.homeId ?? resolved.get(m.number)?.home ?? null,
        awayId: m.awayId ?? resolved.get(m.number)?.away ?? null,
        kickoffAt: m.kickoffAt,
        venue: m.venue,
      }))
      .filter(
        (m) =>
          !team || involvesTeam(m.homeId, team) || involvesTeam(m.awayId, team),
      )
      .filter((m) => !wanted || wanted.has(m.number))
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

    if (selected.length === 0) return "No matching matches.";

    const played = (m: Fixture) =>
      new Date(m.kickoffAt).getTime() + MATCH_WINDOW_MS <= now;
    const upcoming = selected.filter((m) => !played(m));
    const finished = selected.filter(played);

    const today = tournamentDay(new Date(now));
    const out = [
      `Today is ${today} (UTC). Times are UTC — don't convert them; wrap kickoffs in a <local-time> tag so the client localizes them. Answer "when does it play" from the upcoming list; only mention played matches if asked about the past.`,
      "",
      `## Upcoming\n${upcoming.length ? upcoming.map(line).join("\n") : "none"}`,
      `## Already played\n${finished.length ? finished.map(line).join("\n") : "none"}`,
    ];
    if (team && upcoming.length === 0)
      out.push(
        `\n${team} has no scheduled fixture left — its next game is a knockout slot that isn't decided yet. Use show_team_path for where it goes next.`,
      );

    return out.join("\n");
  },
});

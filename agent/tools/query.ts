import { defineTool } from "eve/tools";
import { z } from "zod";

import { ensureSchema, sql, STATS_READER } from "@/lib/stats/db";

const MAX_ROWS = 50;

const SCHEMA = `Tables (Postgres):
- matches: n (FIFA number 1-104, pk), round ('group','r32','r16','qf','sf','third_place','final'), grp (group letter 'A'-'L', null in knockouts), matchday (1-3, null in knockouts), home_code/away_code (FIFA codes, null while a knockout slot is undecided), home_name/away_name, home_score/away_score (null until kickoff; a level knockout score with a winner_code means penalties), status ('scheduled','live','final'), winner_code (null for draws and unplayed), kickoff (timestamptz), venue
- events (live/played matches only): match_n, seq, minute (45'+2 → 45), stoppage (45'+2 → 2, else null), type ('goal','own_goal','penalty_goal','yellow_card','red_card','substitution',…), team_code, team_name, player, detail
- teams: code (pk), name, grp`;

export default defineTool({
  description:
    "One read-only SQL SELECT over what already happened this World Cup — a match's goals/cards/subs, and any cross-match stat the other tools can't do: most/fewest goals, goals before a minute, card counts, scorers, per-team/venue/group aggregates. " +
    SCHEMA +
    " Up to 50 rows come back; aggregate rather than fetch raw rows. Select matches.n whenever matches are the subject. On an error result, fix the SQL and retry. E.g. goals in the first 5 minutes: select m.n, m.home_name, m.away_name, e.minute, e.player from events e join matches m on m.n = e.match_n where e.type in ('goal','penalty_goal','own_goal') and e.minute <= 5 order by e.minute.",
  inputSchema: z.object({
    sql: z
      .string()
      .describe(
        "A single SELECT (or WITH … SELECT) statement, Postgres dialect.",
      ),
  }),
  async execute({ sql: statement }) {
    if (!sql) return { error: "Stats database not configured." };
    const query = statement.trim().replace(/;+\s*$/, "");
    if (!/^(select|with)\b/i.test(query))
      return {
        error:
          "Only a single SELECT (or WITH … SELECT) statement is supported.",
      };
    try {
      await ensureSchema();
      // Defense in depth, all server-enforced: the statement runs as the
      // select-only STATS_READER role inside a READ ONLY transaction, and the
      // wrapper caps the row count regardless of what it asks for.
      const [, rows] = await sql.transaction(
        [
          sql.query(`set local role ${STATS_READER}`),
          sql.query(`select * from (\n${query}\n) as q limit ${MAX_ROWS + 1}`),
        ],
        { readOnly: true },
      );
      if (rows.length > MAX_ROWS)
        return {
          rows: rows.slice(0, MAX_ROWS),
          note: `Truncated to ${MAX_ROWS} rows — aggregate or narrow the query.`,
        };
      return { rows };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message, hint: `Fix the SQL and retry. ${SCHEMA}` };
    }
  },
});

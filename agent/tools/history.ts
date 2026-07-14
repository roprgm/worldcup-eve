// SQL over the historical internationals database (lib/history). Two layers
// keep it safe: the statement must be a single SELECT, and it runs inside a
// READ ONLY Postgres transaction — so a mutation fails at the database no
// matter how it's phrased. Errors return to the model so it can fix its SQL.

import { defineTool } from "eve/tools";
import { z } from "zod";

import { sql } from "@/lib/history/db";

const MAX_ROWS = 200;

export default defineTool({
  description: `Historical football database — every men's full international since 1872 (World Cups, qualifiers, continental cups, friendlies): results, goal scorers with minute, penalty shootouts, World Cup stages. Query it with one read-only SELECT for anything about past matches, head-to-heads, titles, or scoring records. For the live tournament prefer matches/standings/timeline. Tables:
- history_matches(date, home_team, away_team, home_score, away_score, tournament, city, country, neutral, stage) — stage is set on 'FIFA World Cup' rows: 'Group stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Third place', 'Final'.
- history_goals(date, home_team, away_team, team, scorer, minute, own_goal, penalty) — join to matches on (date, home_team, away_team).
- history_shootouts(date, home_team, away_team, winner, first_shooter)
- history_team_names(current_name, former_name, start_date, end_date) — renamed countries appear under today's name for their whole history ('Russia' includes the Soviet era); dissolved teams keep theirs ('Czechoslovakia', 'German DR', 'Yugoslavia').
Prefer aggregates over listing rows; results are capped at ${MAX_ROWS} rows.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "A single SELECT (or WITH … SELECT) statement over the history_* tables. No semicolons.",
      ),
  }),
  async execute({ query }) {
    if (!sql)
      return { error: "History database not configured (no DATABASE_URL)." };
    const statement = query.trim().replace(/;\s*$/, "");
    if (!/^(select|with)\b/i.test(statement) || statement.includes(";"))
      return { error: "Only a single SELECT statement is allowed." };
    try {
      const [, rows] = await sql.transaction(
        [sql.query("set local statement_timeout = 5000"), sql.query(statement)],
        { readOnly: true },
      );
      if (rows.length > MAX_ROWS)
        return { rows: rows.slice(0, MAX_ROWS), totalRows: rows.length };
      return { rows };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  },
});

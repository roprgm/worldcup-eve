import { defineTool } from "eve/tools";
import { z } from "zod";

import { readerQuery, SCHEMA_DOC, sql } from "@/lib/stats/db";

const MAX_ROWS = 50;

export default defineTool({
  description:
    `One read-only SQL SELECT over what already happened this World Cup — a match's goals/cards/subs, and any cross-match stat the other tools can't do: most/fewest goals, goals before a minute, card counts, scorers, per-team/venue/group aggregates. ${SCHEMA_DOC} ` +
    `NOT for a fixture's schedule, score, or venue by itself — matches answers those without SQL. Up to ${MAX_ROWS} rows come back; aggregate rather than fetch raw rows. Select matches.n whenever matches are the subject. On an error result, fix the SQL and retry. E.g. goals in the first 5 minutes: select m.n, m.home_name, m.away_name, e.minute, e.player from events e join matches m on m.n = e.match_n where e.type in ('goal','penalty_goal','own_goal') and e.minute <= 5 order by e.minute.`,
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
      const { rows, truncated } = await readerQuery(query, MAX_ROWS);
      if (truncated)
        return {
          rows,
          note: `Truncated to ${MAX_ROWS} rows — aggregate or narrow the query.`,
        };
      return { rows };
    } catch (error) {
      // Errors go back as data: the model reads the message, repairs its SQL,
      // and retries without the call counting as a failed action.
      const message = error instanceof Error ? error.message : String(error);
      return { error: message, hint: `Fix the SQL and retry. ${SCHEMA_DOC}` };
    }
  },
});

import { defineSqlTool } from "eve-sql-tool";
import { postgres } from "eve-sql-tool/postgres";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL or POSTGRES_URL is required.");
}

export default defineSqlTool({
  database: postgres(databaseUrl),
  tables: [
    "history_matches",
    "history_goals",
    "history_shootouts",
    "history_team_names",
  ],
  description: `
    Historical international football since 1872, including results,
    goal scorers, penalty shootouts, and World Cup stages.

    Join history_goals to history_matches using date, home_team, and away_team.
    Prefer aggregates over long lists. For the live tournament, prefer the
    matches, standings, and timeline tools.

    Renamed countries use their current name across their history. Dissolved
    teams retain their historical name.
  `,
});

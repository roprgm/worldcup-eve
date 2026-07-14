import { defineSchedule } from "eve/schedules";

import { sql } from "@/lib/db";
import { upsertCurrentCup } from "@/lib/history/live";
import { getMatchResults } from "@/lib/results";

// Keep the history database current with this Cup: every ten minutes, upsert
// finished matches from the live feed so all-time questions (finals reached,
// head-to-heads) include a result from minutes ago, not from the last full
// sync. Skips entirely without a DATABASE_URL, and logs failures itself —
// the schedule runner discards rejections silently.
export default defineSchedule({
  cron: "*/10 * * * *",
  run({ waitUntil }) {
    if (!sql) return;
    waitUntil(
      getMatchResults()
        .then((r) => upsertCurrentCup(r.matches))
        .catch((e) => console.error("refresh-history failed:", e)),
    );
  },
});

import { defineSchedule } from "eve/schedules";

import { upsertCurrentCup } from "@/lib/history/live";
import { getMatchResults } from "@/lib/results";

// Keep the history database current with this Cup: every ten minutes, upsert
// finished matches from the live feed so all-time questions (finals reached,
// head-to-heads) include a result from minutes ago, not from the last full
// sync. No-ops without a DATABASE_URL.
export default defineSchedule({
  cron: "*/10 * * * *",
  run({ waitUntil }) {
    waitUntil(getMatchResults().then((r) => upsertCurrentCup(r.matches)));
  },
});

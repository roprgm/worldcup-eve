import { defineSchedule } from "eve/schedules";

import { syncStats } from "@/lib/stats/sync";

// Mirror ESPN into the stats database every minute: scores for all matches,
// timelines for live ones, one-time event ingest per finished match. Runs
// in-process (no LLM); waitUntil keeps the task alive until the sync lands.
export default defineSchedule({
  cron: "* * * * *",
  run({ waitUntil }) {
    waitUntil(syncStats());
  },
});

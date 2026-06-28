import { defineSchedule } from "eve/schedules";

import { refreshPredictions } from "@/lib/predictions";

// Recompute the predictions snapshot every 2 minutes and write it to the cache,
// so reads never hit a cold Bradley-Terry fit. The rebuild runs in-process (no
// LLM, no channel handoff); waitUntil keeps the cron task alive until it lands.
export default defineSchedule({
  cron: "*/2 * * * *",
  run({ waitUntil }) {
    waitUntil(refreshPredictions());
  },
});

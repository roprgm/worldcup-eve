import { defineSchedule } from "eve/schedules";

import { refreshPredictions } from "@/lib/predictions";

// Recompute the predictions snapshot every minute and write it to the cache, so
// reads never hit a cold Bradley-Terry fit. Refreshing faster than the 2-minute
// cache TTL keeps a warm value even if a tick is late or skipped (cron has
// minute granularity, so this is the closest we can run to the TTL). The rebuild
// runs in-process (no LLM, no channel handoff); waitUntil keeps the cron task
// alive until it lands.
export default defineSchedule({
  cron: "* * * * *",
  run({ waitUntil }) {
    waitUntil(refreshPredictions());
  },
});

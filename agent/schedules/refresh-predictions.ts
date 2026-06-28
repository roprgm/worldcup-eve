import { defineSchedule } from "eve/schedules";

import { refreshPredictions } from "@/lib/predictions";

// Warm the predictions cache every minute so reads never hit a cold BT fit.
// Runs in-process (no LLM); waitUntil keeps the task alive until the rebuild lands.
export default defineSchedule({
  cron: "* * * * *",
  run({ waitUntil }) {
    waitUntil(refreshPredictions());
  },
});

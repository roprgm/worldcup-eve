import { defineSchedule } from "eve/schedules";

import { tournamentDay } from "@/agent/lib/time";
import { captureDailySnapshot } from "@/lib/predictions";

// At the tournament-day rollover (07:00 UTC, evaluated by Vercel), persist the
// day's epoch — the warm-start seed and before/after baseline.
export default defineSchedule({
  cron: "0 7 * * *",
  run({ waitUntil }) {
    waitUntil(captureDailySnapshot(tournamentDay(new Date())));
  },
});

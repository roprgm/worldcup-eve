import { defineSchedule } from "eve/schedules";

import { tournamentDay } from "@/agent/lib/time";
import { captureDailySnapshot } from "@/lib/predictions";

// At the tournament-day rollover (07:00 UTC), persist the day's authoritative
// prediction as the epoch that warm-starts every per-minute rebuild and anchors
// the before/after bars. Vercel evaluates cron in UTC; waitUntil keeps the task
// alive until the capture lands.
export default defineSchedule({
  cron: "0 7 * * *",
  run({ waitUntil }) {
    waitUntil(captureDailySnapshot(tournamentDay(new Date())));
  },
});

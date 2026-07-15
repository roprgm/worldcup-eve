import { defineSchedule } from "eve/schedules";

import { sql } from "@/lib/db";
import { syncHistory } from "@/lib/history/sync";

// Rebuild from the canonical public datasets each day. Vercel evaluates cron
// expressions in UTC; the more frequent refresh-history job fills the gap
// between source updates with finished current-Cup matches.
export default defineSchedule({
  cron: "0 6 * * *",
  run({ waitUntil }) {
    if (!sql) return;
    waitUntil(
      syncHistory().catch((e) => console.error("sync-history failed:", e)),
    );
  },
});

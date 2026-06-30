import { defineDynamic, defineInstructions } from "eve/instructions";

import { TOURNAMENT_DAY_ROLLOVER_UTC, tournamentDay } from "@/agent/lib/time";

// Dynamic instructions run per turn, so the agent always knows the current tournament day.
export default defineDynamic({
  events: {
    "turn.started": () => {
      const now = new Date();
      const today = tournamentDay(now);
      return defineInstructions({
        markdown: [
          `Current UTC time: ${now.toISOString()}.`,
          `Internal schedule date for filtering: ${today}; it rolls over at ${TOURNAMENT_DAY_ROLLOVER_UTC}.`,
          `Never convert time zones yourself. For any user-facing date or time, output the raw UTC instant in a <local-time> tag; the client renders it in the reader's locale and time zone. Example: <local-time iso="2026-07-01T19:00:00Z">Jul 1, 19:00 UTC</local-time>.`,
          `Copy the exact UTC kickoff field (the ISO string ending in Z) into iso, and put a short UTC fallback as the tag's text — always close the tag. Add format="date" for a day only, format="time" for a clock time, or omit it for both.`,
          `If next match is in less than an hour, express it as relative time in the user's language instead of a tag.`,
          `Do not display internal schedule filter times as kickoff times.`,
        ].join("\n"),
      });
    },
  },
});

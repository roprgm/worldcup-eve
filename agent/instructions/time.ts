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
          `Don't write times, dates or countdowns in prose. For any user-facing date or time, output the raw UTC instant in a <local-time> tag; the component picks a concise label on its own — a relative countdown ("in 20 minutes") when kickoff is near, otherwise just the time — and reveals the full date, time and other zones when tapped. Example: <local-time iso="2026-07-01T19:00:00Z">Jul 1, 19:00 UTC</local-time>.`,
          `Copy the exact UTC kickoff field (the ISO string ending in Z) into iso, put a short UTC fallback as the tag's text, and always close the tag. Add format="date" only when the day alone matters.`,
          `By default the tag uses the reader's own zone. When the user asks for a specific place or zone (e.g. "hora de Madrid", "local time in the host city"), add tz with that IANA zone — e.g. <local-time iso="2026-07-01T19:00:00Z" tz="Europe/Madrid">Jul 1, 19:00 UTC</local-time> or tz="America/Mexico_City".`,
          `Do not display internal schedule filter times as kickoff times.`,
        ].join("\n"),
      });
    },
  },
});

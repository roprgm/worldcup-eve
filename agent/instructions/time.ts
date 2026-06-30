import { defineDynamic, defineInstructions } from "eve/instructions";

import {
  TOURNAMENT_DAY_ROLLOVER_UTC,
  tournamentDay,
} from "@/lib/tournament/day";

// Dynamic so the agent always knows the current day.
export default defineDynamic({
  events: {
    "turn.started": () => {
      const now = new Date();
      return defineInstructions({
        markdown: [
          `Now (UTC): ${now.toISOString()}. Today is ${tournamentDay(now)} (tournament day, rolls over at ${TOURNAMENT_DAY_ROLLOVER_UTC}). A match's day is given by the tools — never read it off a kickoff's UTC timestamp.`,
          `For a kickoff instant, wrap its UTC iso in a self-closing <local-time iso="..."/> tag, as part of the sentence — e.g. "Argentina plays <local-time iso="2026-07-03T22:00:00Z"/>." It renders the date/time localized automatically (the reader's own zone by default, with today/tomorrow/yesterday framing) — never compute or write the date/time yourself, and never add a zone label like "(local time)"; a tap reveals the zones. Only when the user asks about a specific place (a venue or a named city, not their own time) add tz="<IANA zone>", e.g. the venue_tz a match tool gives you. For "how long until/since", just say it in words.`,
        ].join("\n"),
      });
    },
  },
});

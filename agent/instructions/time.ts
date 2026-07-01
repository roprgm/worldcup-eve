import { defineDynamic, defineInstructions } from "eve/instructions";

import { TOURNAMENT_DAY_ROLLOVER_UTC, tournamentDay } from "@/agent/lib/time";

// Dynamic so the agent always knows the current day.
export default defineDynamic({
  events: {
    "turn.started": () => {
      const now = new Date();
      return defineInstructions({
        markdown: [
          `Now (UTC): ${now.toISOString()}. Today is ${tournamentDay(now)} (tournament day, rolls over at ${TOURNAMENT_DAY_ROLLOVER_UTC}). A match's day is given by the tools — never read it off a kickoff's UTC timestamp.`,
          `Before stating a kickoff's date or time, call convert_time with the kickoff iso and a time zone — the user's own by default (their IANA zone is in the client context), or the stadium (venueTz) / a named city if they ask for that.`,
          `Write that date/time once, INSIDE a <local-time> tag, as part of the sentence — e.g. "Argentina plays <local-time iso="2026-07-03T22:00:00Z">Friday at 3 PM</local-time>." Don't repeat the time outside the tag and don't add a zone label like "(local time)"; it's already the reader's local time and a tap reveals the zones. For "how long until/since", just say it in words.`,
        ].join("\n"),
      });
    },
  },
});

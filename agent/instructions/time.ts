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
          `Before stating a kickoff's date or time, call convert_time with the kickoff iso and a time zone — the user's own by default (their IANA zone is in the client context), or the stadium (venue_tz) / a named city if they ask for that. Write the day and time yourself, naturally and in your reply language, from what it returns.`,
          `Wrap that kickoff text in a <local-time iso="<UTC ISO>">…</local-time> tag so a tap reveals the zones; close it. For "how long until/since", just say it in words.`,
        ].join("\n"),
      });
    },
  },
});

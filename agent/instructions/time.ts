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
          `To say when a match plays, drop a <local-time iso="…Z" lang="…">UTC fallback</local-time> tag where the time goes. It renders the whole "when" in the reader's zone with the day word and connectors ("today at 6:00 PM"), so write none of the date, time, or connecting words yourself. Set lang to your reply language and close the tag.`,
          `Leave tz off by default — the tag then shows the reader's own local time, which is what they want. Add tz="<IANA zone>" ONLY when the user explicitly asks for another place's time (the stadium — its zone is venue_tz — or a named city). For "how long until/since", answer in words.`,
        ].join("\n"),
      });
    },
  },
});

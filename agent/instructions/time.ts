import { defineDynamic, defineInstructions } from "eve/instructions";

import { TOURNAMENT_DAY_ROLLOVER_UTC, tournamentDay } from "@/agent/lib/time";

// Dynamic instructions run per turn so the agent always knows the current day.
export default defineDynamic({
  events: {
    "turn.started": () => {
      const now = new Date();
      return defineInstructions({
        markdown: [
          `Current UTC time: ${now.toISOString()}. Today (tournament day) is ${tournamentDay(now)}; the day rolls over at ${TOURNAMENT_DAY_ROLLOVER_UTC}.`,
          `Decide a match's day (today/tomorrow/...) only from the "day" the tools give it — never from a kickoff's UTC timestamp, which can land on a different calendar date.`,
          `Don't write a kickoff time or date yourself. Wrap the kickoff's UTC instant in a <local-time iso="…Z" lang="…">UTC fallback</local-time> tag; it renders the day and time in the reader's own zone. Set lang to the language you're replying in, always close the tag, and put no preposition or article right before it.`,
          `For the time at the venue or a named place, add tz with that IANA zone (each schedule/venue/result row gives the stadium's zone as venue_tz). For "how long until/since", answer in words ("faltan ~5 días"); a duration needs no tag.`,
        ].join("\n"),
      });
    },
  },
});

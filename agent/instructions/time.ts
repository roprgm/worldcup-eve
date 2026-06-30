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
          `Decide a match's day (today/tomorrow/...) from the "day" the tools give it — never from a kickoff's UTC timestamp, which can fall on a different calendar date.`,
          // How to use the tag.
          `When you mention a specific kickoff's date or time, show it with a <local-time iso="…Z" lang="…">UTC fallback</local-time> tag and never type the date or time yourself. The tag renders the full date and time in the reader's own zone — it is a noun standing for that date/time, so build the sentence around it ("Brazil plays <local-time .../>") and don't add a clock time, weekday or "at/on" of your own next to it. Set lang to the language you're replying in and always close the tag.`,
          // When NOT to use it.
          `Don't use the tag for a duration — for "how long until/since" just say it in words ("faltan ~5 días"). Add tz="<IANA zone>" only when the user asks for the time at the venue or another named place (rows give the stadium's zone as venue_tz).`,
        ].join("\n"),
      });
    },
  },
});

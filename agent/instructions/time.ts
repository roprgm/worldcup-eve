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
          `Use the tool's "day" only to know which match a question is about (e.g. who plays today) — never to write the day yourself.`,
          // How to use the tag.
          `Show any specific kickoff with a <local-time iso="…Z" lang="…">UTC fallback</local-time> tag and never type the date or time yourself. The tag already renders the whole phrase in the reader's zone, day word included — "hoy a las 18:00", "martes a las 18:00", "5 jul a las 18:00". So drop it in where the date/time goes ("México juega <local-time .../>") and add NOTHING of your own next to it — no "hoy", no "el/a las/at/on", no weekday. Set lang to the language you're replying in and always close the tag.`,
          // When NOT to use it.
          `Don't use the tag for a duration — for "how long until/since" just say it in words ("faltan ~5 días"). Add tz="<IANA zone>" only when the user asks for the time at the venue or another named place (rows give the stadium's zone as venue_tz).`,
        ].join("\n"),
      });
    },
  },
});

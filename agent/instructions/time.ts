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
          `Don't write times, dates or countdowns in prose. For any user-facing date or time, output the raw UTC instant in a <local-time iso="…Z"> tag (iso = the exact UTC kickoff field, ISO ending in Z) and the component renders it. Always close the tag and put a short UTC fallback as its text.`,
          `Pick the mode that fits the question (default is "datetime"):`,
          `• mode="datetime" — when something happens, as an absolute day + time: "Sunday at 1:00 PM" (this week) or "Jul 20 at 1:00 PM". Use for "when does X play".`,
          `• mode="relative" — how long until or since, or a casual day word: "in 3 days", "2 weeks ago", "tomorrow". Use for "how long till kickoff", "cuánto falta".`,
          `• mode="time" — just the clock time ("at 1:00 PM"). Use when the day is already known from context — including when the user themselves named it ("hoy", "tomorrow"): write that word yourself and let the tag give the time.`,
          `• mode="date" — just the day ("Sun, Jul 12"). Use for "what day".`,
          `Every mode renders a complete, self-contained phrase. Place the tag as the whole time expression — never put a preposition, verb or article before it (write "plays <local-time .../>", not "plays at <local-time .../>" or "falta <local-time .../>"). Tapping it reveals the full instant across zones.`,
          `ALWAYS set lang to the BCP-47 code of the language you're replying in (e.g. lang="es", lang="en"); the phrase is built in that language. Example: <local-time iso="2026-07-01T19:00:00Z" lang="en">Jul 1, 19:00 UTC</local-time>.`,
          `The tag uses the reader's own zone by default — keep it that way for a plain "what time does X play". When the user asks about the time at the match's location ("where they played", "local time at the stadium") or names a place/zone ("time in Madrid"), add tz with that IANA zone. Each schedule/venue/result row gives the stadium's zone as venue_tz — copy it into tz for venue-local times; otherwise use the named place's IANA zone (e.g. tz="Europe/Madrid").`,
          `Answer every part the user asked: "where and when does Brazil play, and how long until?" → "Brazil plays at NY/NJ Stadium <local-time iso=… mode="datetime" lang="en">Sunday at 1:00 PM</local-time>, <local-time iso=… mode="relative" lang="en">in 3 days</local-time>."`,
          `Do not display internal schedule filter times as kickoff times.`,
        ].join("\n"),
      });
    },
  },
});

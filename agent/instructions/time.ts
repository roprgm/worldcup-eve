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
          `Don't write times, dates or countdowns in prose. For any user-facing date or time, output the raw UTC instant in a <local-time> tag. The component renders a complete, natural time phrase on its own — "in 20 minutes", "today at 6:00 PM", "Thursday at 12:30 PM" — and reveals the full date and other zones when tapped.`,
          `ALWAYS set lang to the BCP-47 code of the language you're replying in (e.g. lang="en", lang="fr"); the phrase is built in that language. Example: <local-time iso="2026-07-01T19:00:00Z" lang="en">Jul 1, 19:00 UTC</local-time>.`,
          `The tag IS the whole time expression, with its own connector. Do not put a preposition or article before it — write "plays <local-time .../>" (which renders e.g. "today at 6:00 PM"), never "plays at <local-time .../>" or "at <local-time .../>". Copy the exact UTC kickoff field (ISO ending in Z) into iso, put a short UTC fallback as the text, and always close the tag.`,
          `When the user asks how long until/since ("how long till kickoff", "cuánto falta"), add format="relative" to that tag; it renders a standalone duration like "in 3 days" or "2 weeks ago". It's self-contained too — don't prefix it with a verb or preposition like "it's in" / "falta".`,
          `The tag uses the reader's own zone by default — keep it that way for a plain "what time does X play". When the user asks about the time at the match's location ("what time was it there", "where they played", "local time at the stadium") or names a place/zone ("time in Madrid"), add tz with that IANA zone. Each schedule/venue/result row gives the stadium's zone as venue_tz — copy it into tz for venue-local times; otherwise use the named place's IANA zone (e.g. tz="Europe/Madrid").`,
          `Do not display internal schedule filter times as kickoff times.`,
        ].join("\n"),
      });
    },
  },
});

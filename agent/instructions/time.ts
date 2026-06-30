import type { ModelMessage } from "ai";
import { defineDynamic, defineInstructions } from "eve/instructions";

import { TOURNAMENT_DAY_ROLLOVER_UTC, tournamentDay } from "@/agent/lib/time";
import { matchSchedule, teamById } from "@/lib/tournament";

const DAY_MS = 24 * 60 * 60 * 1000;

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

function messageText(content: ModelMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text: unknown }).text)
          : "",
      )
      .join(" ");
  return "";
}

// The client sends its IANA zone via clientContext, which eve serializes into a
// user-role context message. Read the most recent one so day reasoning happens
// in the user's calendar, not UTC.
function userTimeZone(messages: readonly ModelMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const match = messageText(message.content).match(
      /"timeZone"\s*:\s*"([^"]+)"/,
    );
    if (!match) continue;
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: match[1] });
      return match[1];
    } catch {
      // Not a real zone — keep scanning older messages.
    }
  }
  return undefined;
}

// YYYY-MM-DD calendar day of an instant in a zone.
function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function matchesOn(localDay: string, timeZone: string): string {
  const lines = matchSchedule
    .filter((m) => dayKey(new Date(m.kickoffAt), timeZone) === localDay)
    .map(
      (m) =>
        `match ${m.number}: ${teamName(m.homeId)} vs ${teamName(m.awayId)}, kickoff ${m.kickoffAt}`,
    );
  return lines.length ? lines.join("; ") : "none";
}

// Dynamic instructions run per turn, so the agent always knows the current time
// and — when the client shares its zone — which matches fall on the user's day.
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const now = new Date();
      const timeZone = userTimeZone(ctx.messages);

      const dayLines: string[] = [];
      if (timeZone) {
        const localNow = new Intl.DateTimeFormat("en-CA", {
          timeZone,
          weekday: "short",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(now);
        const today = dayKey(now, timeZone);
        const tomorrow = dayKey(new Date(now.getTime() + DAY_MS), timeZone);
        dayLines.push(
          `User's local now: ${localNow} (${timeZone}). Decide "today / tomorrow / this week" and any day word from the user's local calendar day in this zone — never from UTC or the filter date.`,
          `Matches on the user's local today (${today}): ${matchesOn(today, timeZone)}.`,
          `Matches on the user's local tomorrow (${tomorrow}): ${matchesOn(tomorrow, timeZone)}.`,
        );
      } else {
        dayLines.push(
          `User time zone unknown — if asked what's on "today", answer by UTC day and say times are UTC.`,
        );
      }

      return defineInstructions({
        markdown: [
          `Current UTC time: ${now.toISOString()}.`,
          `Internal schedule filter date: ${tournamentDay(now)} (tournament day, rolls over at ${TOURNAMENT_DAY_ROLLOVER_UTC}). This is an internal filter, not the user's calendar day — don't use it to decide what's "today".`,
          ...dayLines,
          `Don't write an absolute kickoff time or date yourself — wrap it in a <local-time iso="…Z"> tag (iso = the exact UTC kickoff field, ISO ending in Z) and the component converts it to the reader's zone. Always close the tag and put a short UTC fallback as its text. Use the tag only for an actual clock time or date; for "how long until/since" (cuánto falta) just answer in words ("faltan ~5 días", "in about an hour") — a duration needs no conversion.`,
          `Pick the mode (default is "datetime"):`,
          `• mode="datetime" — an absolute day + time: "Sunday at 1:00 PM" (this week) or "Jul 20 at 1:00 PM". Use for "when does X play".`,
          `• mode="time" — just the clock time ("at 1:00 PM"). Use when the day is already known — including when the user named it ("hoy"): write that word yourself and let the tag give the time.`,
          `• mode="date" — just the day ("Sun, Jul 12"). Use for "what day".`,
          `Every mode renders a complete, self-contained phrase. Place the tag as the whole time expression — never put a preposition, verb or article before it (write "plays <local-time .../>", not "plays at <local-time .../>"). Tapping it reveals the full instant across zones.`,
          `ALWAYS set lang to the BCP-47 code of the language you're replying in (e.g. lang="es", lang="en"); the phrase is built in that language. Example: <local-time iso="2026-07-01T19:00:00Z" lang="en">Jul 1, 19:00 UTC</local-time>.`,
          `The tag uses the reader's own zone by default. When the user asks about the time at the match's location ("where they played", "local time at the stadium") or names a place/zone ("time in Madrid"), add tz with that IANA zone. Each schedule/venue/result row gives the stadium's zone as venue_tz — copy it into tz for venue-local times; otherwise use the named place's IANA zone (e.g. tz="Europe/Madrid").`,
          `Do not display internal schedule filter times as kickoff times.`,
        ].join("\n"),
      });
    },
  },
});

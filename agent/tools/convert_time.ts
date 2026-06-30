import { defineTool } from "eve/tools";
import { z } from "zod";

const dayInZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

function relativeDay(date: Date, timeZone: string): string | null {
  const days =
    (Date.parse(dayInZone(date, timeZone)) -
      Date.parse(dayInZone(new Date(), timeZone))) /
    86_400_000;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return null;
}

export default defineTool({
  description:
    "Convert a UTC kickoff instant into a time zone: its local weekday, date, clock time (12h and 24h), and whether it's today/tomorrow/yesterday there. Use it to state a kickoff in the user's own time (their IANA zone is in the client context) or a place they ask about, then write the day/time yourself and wrap the instant in a <local-time> tag.",
  inputSchema: z.object({
    iso: z
      .string()
      .describe("Kickoff instant as UTC ISO 8601, e.g. 2026-07-01T01:00:00Z."),
    timeZone: z
      .string()
      .describe("IANA zone to convert to, e.g. America/Los_Angeles."),
  }),
  execute({ iso, timeZone }) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return `Invalid iso: ${iso}.`;
    const inZone = (options: Intl.DateTimeFormatOptions) => {
      try {
        return new Intl.DateTimeFormat("en-US", {
          timeZone,
          ...options,
        }).format(date);
      } catch {
        return null;
      }
    };
    const weekday = inZone({ weekday: "long" });
    if (weekday === null) return `Unknown time zone: ${timeZone}.`;
    return {
      relativeDay: relativeDay(date, timeZone),
      weekday,
      date: inZone({ month: "long", day: "numeric" }),
      time24: inZone({ hour: "2-digit", minute: "2-digit", hour12: false }),
      time12: inZone({ hour: "numeric", minute: "2-digit", hour12: true }),
    };
  },
});

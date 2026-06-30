// Tournament days roll over at 07:00 UTC so late Americas kickoffs stay on the intended day.
const DAY_ROLLOVER_UTC_HOUR = 7;
const HOUR_MS = 60 * 60 * 1000;

export const TOURNAMENT_DAY_ROLLOVER_UTC = "07:00 UTC";

function tournamentClock(date: Date): string {
  return new Date(
    date.getTime() - DAY_ROLLOVER_UTC_HOUR * HOUR_MS,
  ).toISOString();
}

export function tournamentDay(date: Date): string {
  return tournamentClock(date).slice(0, 10);
}

// Whole-day index of a tournament day, so day differences (today vs tomorrow)
// are a subtraction instead of date math.
export function tournamentDayIndex(date: Date): number {
  return Math.floor(
    (date.getTime() - DAY_ROLLOVER_UTC_HOUR * HOUR_MS) / (24 * HOUR_MS),
  );
}

// "today" / "tomorrow" / "yesterday" relative to now, else the tournament day,
// all by tournament day — never the raw UTC calendar date, which can differ.
export function relativeTournamentDay(kickoff: Date, now: Date): string {
  const diff = tournamentDayIndex(kickoff) - tournamentDayIndex(now);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return tournamentDay(kickoff);
}

export function tournamentTime(date: Date): string {
  return tournamentClock(date).slice(11, 16);
}

export function tournamentDateTime(date: Date): string {
  return `${tournamentDay(date)}T${tournamentTime(date)}`;
}

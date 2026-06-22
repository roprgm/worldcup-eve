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

export function tournamentTime(date: Date): string {
  return tournamentClock(date).slice(11, 16);
}

export function tournamentDateTime(date: Date): string {
  return `${tournamentDay(date)}T${tournamentTime(date)}`;
}

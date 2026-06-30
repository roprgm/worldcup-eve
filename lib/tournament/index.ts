// The 2026 World Cup, as static facts: 48 teams, the 12 groups and their
// round-robin fixtures, and the knockout bracket graph (matches 73–104) with
// schedule and venue metadata. This module queries nothing — it is the single
// source of truth the predictions and results modules build on.

// biome-ignore format: keep this compact
export type GroupLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";
export type Round = "R32" | "R16" | "QF" | "SF" | "TP" | "FINAL";

export interface Team {
  id: string; // FIFA 3-letter code, e.g. "MEX"; also keys the flag image
  name: string;
  group: GroupLetter;
}
/** A group-stage round-robin fixture, e.g. "A1".."L6", with its FIFA match
 *  number (1–72), kickoff and venue. */
export interface GroupMatch {
  id: string;
  number: number;
  group: GroupLetter;
  matchday: 1 | 2 | 3;
  homeId: string;
  awayId: string;
  kickoffAt: string; // ISO 8601 UTC
  venue: string;
}

/** Where a knockout slot's team comes from. */
export type SlotRef =
  | { kind: "winner"; group: GroupLetter }
  | { kind: "runner"; group: GroupLetter }
  | { kind: "third"; groups: GroupLetter[]; resolved: GroupLetter } // 3rd of one of N groups
  | { kind: "match"; match: number } // winner of match N
  | { kind: "loser"; match: number }; // loser of match N (third-place play-off)

export interface KnockoutMatch {
  number: number;
  round: Round;
  home: SlotRef;
  away: SlotRef;
  feedsInto?: number; // match the winner advances to (absent for the final and play-off)
  kickoffAt: string; // ISO 8601 UTC
  venue: string;
}

export const teams: Team[] = [
  { id: "MEX", name: "Mexico", group: "A" },
  { id: "RSA", name: "South Africa", group: "A" },
  { id: "KOR", name: "South Korea", group: "A" },
  { id: "CZE", name: "Czechia", group: "A" },
  { id: "CAN", name: "Canada", group: "B" },
  { id: "BIH", name: "Bosnia & Herzegovina", group: "B" },
  { id: "QAT", name: "Qatar", group: "B" },
  { id: "SUI", name: "Switzerland", group: "B" },
  { id: "BRA", name: "Brazil", group: "C" },
  { id: "MAR", name: "Morocco", group: "C" },
  { id: "HAI", name: "Haiti", group: "C" },
  { id: "SCO", name: "Scotland", group: "C" },
  { id: "USA", name: "United States", group: "D" },
  { id: "PAR", name: "Paraguay", group: "D" },
  { id: "AUS", name: "Australia", group: "D" },
  { id: "TUR", name: "Türkiye", group: "D" },
  { id: "GER", name: "Germany", group: "E" },
  { id: "CUW", name: "Curaçao", group: "E" },
  { id: "CIV", name: "Ivory Coast", group: "E" },
  { id: "ECU", name: "Ecuador", group: "E" },
  { id: "NED", name: "Netherlands", group: "F" },
  { id: "JPN", name: "Japan", group: "F" },
  { id: "SWE", name: "Sweden", group: "F" },
  { id: "TUN", name: "Tunisia", group: "F" },
  { id: "BEL", name: "Belgium", group: "G" },
  { id: "EGY", name: "Egypt", group: "G" },
  { id: "IRN", name: "Iran", group: "G" },
  { id: "NZL", name: "New Zealand", group: "G" },
  { id: "ESP", name: "Spain", group: "H" },
  { id: "CPV", name: "Cape Verde", group: "H" },
  { id: "KSA", name: "Saudi Arabia", group: "H" },
  { id: "URU", name: "Uruguay", group: "H" },
  { id: "FRA", name: "France", group: "I" },
  { id: "SEN", name: "Senegal", group: "I" },
  { id: "IRQ", name: "Iraq", group: "I" },
  { id: "NOR", name: "Norway", group: "I" },
  { id: "ARG", name: "Argentina", group: "J" },
  { id: "ALG", name: "Algeria", group: "J" },
  { id: "AUT", name: "Austria", group: "J" },
  { id: "JOR", name: "Jordan", group: "J" },
  { id: "POR", name: "Portugal", group: "K" },
  { id: "COD", name: "DR Congo", group: "K" },
  { id: "UZB", name: "Uzbekistan", group: "K" },
  { id: "COL", name: "Colombia", group: "K" },
  { id: "ENG", name: "England", group: "L" },
  { id: "CRO", name: "Croatia", group: "L" },
  { id: "GHA", name: "Ghana", group: "L" },
  { id: "PAN", name: "Panama", group: "L" },
];

export const teamById: Record<string, Team> = Object.fromEntries(
  teams.map((t) => [t.id, t]),
);

/** All 48 FIFA codes, in seeding order — handy when only codes are needed. */
export const teamCodes: string[] = teams.map((t) => t.id);

export const groupLetters: GroupLetter[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
];

/** group letter → its 4 team codes, in seeding order. */
export const groupTeams: Record<GroupLetter, string[]> = Object.fromEntries(
  groupLetters.map((letter) => [
    letter,
    teams.filter((t) => t.group === letter).map((t) => t.id),
  ]),
) as Record<GroupLetter, string[]>;

export interface Group {
  letter: GroupLetter;
  teamIds: string[]; // 4 team codes, in seeding order
}
export const groups: Group[] = groupLetters.map((letter) => ({
  letter,
  teamIds: groupTeams[letter],
}));

// FIFA match number → kickoff and venue, the single schedule source for all 104
// matches. Group rows (1–72) also carry the team pair: the only source of the
// official numbering for the round-robin fixtures. Knockout rows (73–104) are
// numbered structurally, so they list no teams.
interface ScheduleRow {
  n: number;
  home?: string;
  away?: string;
  kickoffAt: string;
  venue: string;
}
const schedule: ScheduleRow[] = [
  {
    n: 1,
    home: "MEX",
    away: "RSA",
    kickoffAt: "2026-06-11T19:00:00Z",
    venue: "Mexico City Stadium",
  },
  {
    n: 2,
    home: "KOR",
    away: "CZE",
    kickoffAt: "2026-06-12T02:00:00Z",
    venue: "Guadalajara Stadium",
  },
  {
    n: 3,
    home: "CAN",
    away: "BIH",
    kickoffAt: "2026-06-12T19:00:00Z",
    venue: "Toronto Stadium",
  },
  {
    n: 4,
    home: "USA",
    away: "PAR",
    kickoffAt: "2026-06-13T01:00:00Z",
    venue: "Los Angeles Stadium",
  },
  {
    n: 5,
    home: "HAI",
    away: "SCO",
    kickoffAt: "2026-06-14T01:00:00Z",
    venue: "Boston Stadium",
  },
  {
    n: 6,
    home: "AUS",
    away: "TUR",
    kickoffAt: "2026-06-14T04:00:00Z",
    venue: "BC Place Vancouver",
  },
  {
    n: 7,
    home: "BRA",
    away: "MAR",
    kickoffAt: "2026-06-13T22:00:00Z",
    venue: "New York/New Jersey Stadium",
  },
  {
    n: 8,
    home: "QAT",
    away: "SUI",
    kickoffAt: "2026-06-13T19:00:00Z",
    venue: "San Francisco Bay Area Stadium",
  },
  {
    n: 9,
    home: "CIV",
    away: "ECU",
    kickoffAt: "2026-06-14T23:00:00Z",
    venue: "Philadelphia Stadium",
  },
  {
    n: 10,
    home: "GER",
    away: "CUW",
    kickoffAt: "2026-06-14T17:00:00Z",
    venue: "Houston Stadium",
  },
  {
    n: 11,
    home: "NED",
    away: "JPN",
    kickoffAt: "2026-06-14T20:00:00Z",
    venue: "Dallas Stadium",
  },
  {
    n: 12,
    home: "SWE",
    away: "TUN",
    kickoffAt: "2026-06-15T02:00:00Z",
    venue: "Monterrey Stadium",
  },
  {
    n: 13,
    home: "KSA",
    away: "URU",
    kickoffAt: "2026-06-15T22:00:00Z",
    venue: "Miami Stadium",
  },
  {
    n: 14,
    home: "ESP",
    away: "CPV",
    kickoffAt: "2026-06-15T16:00:00Z",
    venue: "Atlanta Stadium",
  },
  {
    n: 15,
    home: "IRN",
    away: "NZL",
    kickoffAt: "2026-06-16T01:00:00Z",
    venue: "Los Angeles Stadium",
  },
  {
    n: 16,
    home: "BEL",
    away: "EGY",
    kickoffAt: "2026-06-15T19:00:00Z",
    venue: "Seattle Stadium",
  },
  {
    n: 17,
    home: "FRA",
    away: "SEN",
    kickoffAt: "2026-06-16T19:00:00Z",
    venue: "New York/New Jersey Stadium",
  },
  {
    n: 18,
    home: "IRQ",
    away: "NOR",
    kickoffAt: "2026-06-16T22:00:00Z",
    venue: "Boston Stadium",
  },
  {
    n: 19,
    home: "ARG",
    away: "ALG",
    kickoffAt: "2026-06-17T01:00:00Z",
    venue: "Kansas City Stadium",
  },
  {
    n: 20,
    home: "AUT",
    away: "JOR",
    kickoffAt: "2026-06-17T04:00:00Z",
    venue: "San Francisco Bay Area Stadium",
  },
  {
    n: 21,
    home: "GHA",
    away: "PAN",
    kickoffAt: "2026-06-17T23:00:00Z",
    venue: "Toronto Stadium",
  },
  {
    n: 22,
    home: "ENG",
    away: "CRO",
    kickoffAt: "2026-06-17T20:00:00Z",
    venue: "Dallas Stadium",
  },
  {
    n: 23,
    home: "POR",
    away: "COD",
    kickoffAt: "2026-06-17T17:00:00Z",
    venue: "Houston Stadium",
  },
  {
    n: 24,
    home: "UZB",
    away: "COL",
    kickoffAt: "2026-06-18T02:00:00Z",
    venue: "Mexico City Stadium",
  },
  {
    n: 25,
    home: "CZE",
    away: "RSA",
    kickoffAt: "2026-06-18T16:00:00Z",
    venue: "Atlanta Stadium",
  },
  {
    n: 26,
    home: "SUI",
    away: "BIH",
    kickoffAt: "2026-06-18T19:00:00Z",
    venue: "Los Angeles Stadium",
  },
  {
    n: 27,
    home: "CAN",
    away: "QAT",
    kickoffAt: "2026-06-18T22:00:00Z",
    venue: "BC Place Vancouver",
  },
  {
    n: 28,
    home: "MEX",
    away: "KOR",
    kickoffAt: "2026-06-19T01:00:00Z",
    venue: "Guadalajara Stadium",
  },
  {
    n: 29,
    home: "BRA",
    away: "HAI",
    kickoffAt: "2026-06-20T00:30:00Z",
    venue: "Philadelphia Stadium",
  },
  {
    n: 30,
    home: "SCO",
    away: "MAR",
    kickoffAt: "2026-06-19T22:00:00Z",
    venue: "Boston Stadium",
  },
  {
    n: 31,
    home: "TUR",
    away: "PAR",
    kickoffAt: "2026-06-20T03:00:00Z",
    venue: "San Francisco Bay Area Stadium",
  },
  {
    n: 32,
    home: "USA",
    away: "AUS",
    kickoffAt: "2026-06-19T19:00:00Z",
    venue: "Seattle Stadium",
  },
  {
    n: 33,
    home: "GER",
    away: "CIV",
    kickoffAt: "2026-06-20T20:00:00Z",
    venue: "Toronto Stadium",
  },
  {
    n: 34,
    home: "ECU",
    away: "CUW",
    kickoffAt: "2026-06-21T00:00:00Z",
    venue: "Kansas City Stadium",
  },
  {
    n: 35,
    home: "NED",
    away: "SWE",
    kickoffAt: "2026-06-20T17:00:00Z",
    venue: "Houston Stadium",
  },
  {
    n: 36,
    home: "TUN",
    away: "JPN",
    kickoffAt: "2026-06-21T04:00:00Z",
    venue: "Monterrey Stadium",
  },
  {
    n: 37,
    home: "URU",
    away: "CPV",
    kickoffAt: "2026-06-21T22:00:00Z",
    venue: "Miami Stadium",
  },
  {
    n: 38,
    home: "ESP",
    away: "KSA",
    kickoffAt: "2026-06-21T16:00:00Z",
    venue: "Atlanta Stadium",
  },
  {
    n: 39,
    home: "BEL",
    away: "IRN",
    kickoffAt: "2026-06-21T19:00:00Z",
    venue: "Los Angeles Stadium",
  },
  {
    n: 40,
    home: "NZL",
    away: "EGY",
    kickoffAt: "2026-06-22T01:00:00Z",
    venue: "BC Place Vancouver",
  },
  {
    n: 41,
    home: "NOR",
    away: "SEN",
    kickoffAt: "2026-06-23T00:00:00Z",
    venue: "New York/New Jersey Stadium",
  },
  {
    n: 42,
    home: "FRA",
    away: "IRQ",
    kickoffAt: "2026-06-22T21:00:00Z",
    venue: "Philadelphia Stadium",
  },
  {
    n: 43,
    home: "ARG",
    away: "AUT",
    kickoffAt: "2026-06-22T17:00:00Z",
    venue: "Dallas Stadium",
  },
  {
    n: 44,
    home: "JOR",
    away: "ALG",
    kickoffAt: "2026-06-23T03:00:00Z",
    venue: "San Francisco Bay Area Stadium",
  },
  {
    n: 45,
    home: "ENG",
    away: "GHA",
    kickoffAt: "2026-06-23T20:00:00Z",
    venue: "Boston Stadium",
  },
  {
    n: 46,
    home: "PAN",
    away: "CRO",
    kickoffAt: "2026-06-23T23:00:00Z",
    venue: "Toronto Stadium",
  },
  {
    n: 47,
    home: "POR",
    away: "UZB",
    kickoffAt: "2026-06-23T17:00:00Z",
    venue: "Houston Stadium",
  },
  {
    n: 48,
    home: "COL",
    away: "COD",
    kickoffAt: "2026-06-24T02:00:00Z",
    venue: "Guadalajara Stadium",
  },
  {
    n: 49,
    home: "SCO",
    away: "BRA",
    kickoffAt: "2026-06-24T22:00:00Z",
    venue: "Miami Stadium",
  },
  {
    n: 50,
    home: "MAR",
    away: "HAI",
    kickoffAt: "2026-06-24T22:00:00Z",
    venue: "Atlanta Stadium",
  },
  {
    n: 51,
    home: "SUI",
    away: "CAN",
    kickoffAt: "2026-06-24T19:00:00Z",
    venue: "BC Place Vancouver",
  },
  {
    n: 52,
    home: "BIH",
    away: "QAT",
    kickoffAt: "2026-06-24T19:00:00Z",
    venue: "Seattle Stadium",
  },
  {
    n: 53,
    home: "CZE",
    away: "MEX",
    kickoffAt: "2026-06-25T01:00:00Z",
    venue: "Mexico City Stadium",
  },
  {
    n: 54,
    home: "RSA",
    away: "KOR",
    kickoffAt: "2026-06-25T01:00:00Z",
    venue: "Monterrey Stadium",
  },
  {
    n: 55,
    home: "CUW",
    away: "CIV",
    kickoffAt: "2026-06-25T20:00:00Z",
    venue: "Philadelphia Stadium",
  },
  {
    n: 56,
    home: "ECU",
    away: "GER",
    kickoffAt: "2026-06-25T20:00:00Z",
    venue: "New York/New Jersey Stadium",
  },
  {
    n: 57,
    home: "JPN",
    away: "SWE",
    kickoffAt: "2026-06-25T23:00:00Z",
    venue: "Dallas Stadium",
  },
  {
    n: 58,
    home: "TUN",
    away: "NED",
    kickoffAt: "2026-06-25T23:00:00Z",
    venue: "Kansas City Stadium",
  },
  {
    n: 59,
    home: "TUR",
    away: "USA",
    kickoffAt: "2026-06-26T02:00:00Z",
    venue: "Los Angeles Stadium",
  },
  {
    n: 60,
    home: "PAR",
    away: "AUS",
    kickoffAt: "2026-06-26T02:00:00Z",
    venue: "San Francisco Bay Area Stadium",
  },
  {
    n: 61,
    home: "NOR",
    away: "FRA",
    kickoffAt: "2026-06-26T19:00:00Z",
    venue: "Boston Stadium",
  },
  {
    n: 62,
    home: "SEN",
    away: "IRQ",
    kickoffAt: "2026-06-26T19:00:00Z",
    venue: "Toronto Stadium",
  },
  {
    n: 63,
    home: "EGY",
    away: "IRN",
    kickoffAt: "2026-06-27T03:00:00Z",
    venue: "Seattle Stadium",
  },
  {
    n: 64,
    home: "NZL",
    away: "BEL",
    kickoffAt: "2026-06-27T03:00:00Z",
    venue: "BC Place Vancouver",
  },
  {
    n: 65,
    home: "CPV",
    away: "KSA",
    kickoffAt: "2026-06-27T00:00:00Z",
    venue: "Houston Stadium",
  },
  {
    n: 66,
    home: "URU",
    away: "ESP",
    kickoffAt: "2026-06-27T00:00:00Z",
    venue: "Guadalajara Stadium",
  },
  {
    n: 67,
    home: "PAN",
    away: "ENG",
    kickoffAt: "2026-06-27T21:00:00Z",
    venue: "New York/New Jersey Stadium",
  },
  {
    n: 68,
    home: "CRO",
    away: "GHA",
    kickoffAt: "2026-06-27T21:00:00Z",
    venue: "Philadelphia Stadium",
  },
  {
    n: 69,
    home: "ALG",
    away: "AUT",
    kickoffAt: "2026-06-28T02:00:00Z",
    venue: "Kansas City Stadium",
  },
  {
    n: 70,
    home: "JOR",
    away: "ARG",
    kickoffAt: "2026-06-28T02:00:00Z",
    venue: "Dallas Stadium",
  },
  {
    n: 71,
    home: "COL",
    away: "POR",
    kickoffAt: "2026-06-27T23:30:00Z",
    venue: "Miami Stadium",
  },
  {
    n: 72,
    home: "COD",
    away: "UZB",
    kickoffAt: "2026-06-27T23:30:00Z",
    venue: "Atlanta Stadium",
  },
  { n: 73, kickoffAt: "2026-06-28T19:00:00Z", venue: "Los Angeles Stadium" },
  { n: 74, kickoffAt: "2026-06-29T20:30:00Z", venue: "Boston Stadium" },
  { n: 75, kickoffAt: "2026-06-30T01:00:00Z", venue: "Monterrey Stadium" },
  { n: 76, kickoffAt: "2026-06-29T17:00:00Z", venue: "Houston Stadium" },
  {
    n: 77,
    kickoffAt: "2026-06-30T21:00:00Z",
    venue: "New York/New Jersey Stadium",
  },
  { n: 78, kickoffAt: "2026-06-30T17:00:00Z", venue: "Dallas Stadium" },
  { n: 79, kickoffAt: "2026-07-01T01:00:00Z", venue: "Mexico City Stadium" },
  { n: 80, kickoffAt: "2026-07-01T16:00:00Z", venue: "Atlanta Stadium" },
  {
    n: 81,
    kickoffAt: "2026-07-02T00:00:00Z",
    venue: "San Francisco Bay Area Stadium",
  },
  { n: 82, kickoffAt: "2026-07-01T20:00:00Z", venue: "Seattle Stadium" },
  { n: 83, kickoffAt: "2026-07-02T23:00:00Z", venue: "Toronto Stadium" },
  { n: 84, kickoffAt: "2026-07-02T19:00:00Z", venue: "Los Angeles Stadium" },
  { n: 85, kickoffAt: "2026-07-03T03:00:00Z", venue: "BC Place Vancouver" },
  { n: 86, kickoffAt: "2026-07-03T22:00:00Z", venue: "Miami Stadium" },
  { n: 87, kickoffAt: "2026-07-04T01:30:00Z", venue: "Kansas City Stadium" },
  { n: 88, kickoffAt: "2026-07-03T18:00:00Z", venue: "Dallas Stadium" },
  { n: 89, kickoffAt: "2026-07-04T21:00:00Z", venue: "Philadelphia Stadium" },
  { n: 90, kickoffAt: "2026-07-04T17:00:00Z", venue: "Houston Stadium" },
  {
    n: 91,
    kickoffAt: "2026-07-05T20:00:00Z",
    venue: "New York/New Jersey Stadium",
  },
  { n: 92, kickoffAt: "2026-07-06T00:00:00Z", venue: "Mexico City Stadium" },
  { n: 93, kickoffAt: "2026-07-06T19:00:00Z", venue: "Dallas Stadium" },
  { n: 94, kickoffAt: "2026-07-07T00:00:00Z", venue: "Seattle Stadium" },
  { n: 95, kickoffAt: "2026-07-07T16:00:00Z", venue: "Atlanta Stadium" },
  { n: 96, kickoffAt: "2026-07-07T20:00:00Z", venue: "BC Place Vancouver" },
  { n: 97, kickoffAt: "2026-07-09T20:00:00Z", venue: "Boston Stadium" },
  { n: 98, kickoffAt: "2026-07-10T19:00:00Z", venue: "Los Angeles Stadium" },
  { n: 99, kickoffAt: "2026-07-11T21:00:00Z", venue: "Miami Stadium" },
  { n: 100, kickoffAt: "2026-07-12T01:00:00Z", venue: "Kansas City Stadium" },
  { n: 101, kickoffAt: "2026-07-14T19:00:00Z", venue: "Dallas Stadium" },
  { n: 102, kickoffAt: "2026-07-15T19:00:00Z", venue: "Atlanta Stadium" },
  { n: 103, kickoffAt: "2026-07-18T21:00:00Z", venue: "Miami Stadium" },
  {
    n: 104,
    kickoffAt: "2026-07-19T19:00:00Z",
    venue: "New York/New Jersey Stadium",
  },
];

const scheduleByNumber = new Map(schedule.map((s) => [s.n, s]));
const scheduleByPair = new Map(
  schedule
    .filter((s) => s.home)
    .map((s) => [[s.home, s.away].sort().join("|"), s]),
);

// Round-robin: each group's 4 teams play 6 fixtures across 3 matchdays, each
// enriched with its FIFA number, kickoff and venue from the schedule.
export const groupMatches: GroupMatch[] = groupLetters.flatMap((L) => {
  const [a, b, c, d] = groupTeams[L];
  const base = [
    { id: `${L}1`, group: L, matchday: 1, homeId: a, awayId: b },
    { id: `${L}2`, group: L, matchday: 1, homeId: c, awayId: d },
    { id: `${L}3`, group: L, matchday: 2, homeId: a, awayId: c },
    { id: `${L}4`, group: L, matchday: 2, homeId: d, awayId: b },
    { id: `${L}5`, group: L, matchday: 3, homeId: d, awayId: a },
    { id: `${L}6`, group: L, matchday: 3, homeId: b, awayId: c },
  ] as const;
  return base.map((m) => {
    const s = scheduleByPair.get([m.homeId, m.awayId].sort().join("|"));
    if (!s) throw new Error(`No schedule for fixture ${m.id}`);
    return { ...m, number: s.n, kickoffAt: s.kickoffAt, venue: s.venue };
  });
});

// The group fixture between two teams (order-independent), or undefined for a
// pair that never meets in the group stage. Used to match live/market data —
// keyed by team ids — back to our fixtures.
const fixtureByPair = new Map(
  groupMatches.map((m) => [[m.homeId, m.awayId].sort().join("|"), m]),
);
export const groupFixture = (a: string, b: string): GroupMatch | undefined =>
  fixtureByPair.get([a, b].sort().join("|"));

// The bracket graph (matches 73–104). Third-place slots are pre-resolved to one
// valid group (only 8 of 12 thirds advance); the winner/runner/third refs drive
// both rendering and the model. Kickoff and venue come from the schedule.
const knockoutBracket: Omit<KnockoutMatch, "kickoffAt" | "venue">[] = [
  {
    number: 73,
    round: "R32",
    home: { kind: "runner", group: "A" },
    away: { kind: "runner", group: "B" },
    feedsInto: 90,
  },
  {
    number: 74,
    round: "R32",
    home: { kind: "winner", group: "E" },
    away: { kind: "third", groups: ["A", "B", "C", "D", "F"], resolved: "A" },
    feedsInto: 89,
  },
  {
    number: 75,
    round: "R32",
    home: { kind: "winner", group: "F" },
    away: { kind: "runner", group: "C" },
    feedsInto: 90,
  },
  {
    number: 76,
    round: "R32",
    home: { kind: "winner", group: "C" },
    away: { kind: "runner", group: "F" },
    feedsInto: 91,
  },
  {
    number: 77,
    round: "R32",
    home: { kind: "winner", group: "I" },
    away: { kind: "third", groups: ["C", "D", "F", "G", "H"], resolved: "C" },
    feedsInto: 89,
  },
  {
    number: 78,
    round: "R32",
    home: { kind: "runner", group: "E" },
    away: { kind: "runner", group: "I" },
    feedsInto: 91,
  },
  {
    number: 79,
    round: "R32",
    home: { kind: "winner", group: "A" },
    away: { kind: "third", groups: ["C", "E", "F", "H", "I"], resolved: "F" },
    feedsInto: 92,
  },
  {
    number: 80,
    round: "R32",
    home: { kind: "winner", group: "L" },
    away: { kind: "third", groups: ["E", "H", "I", "J", "K"], resolved: "H" },
    feedsInto: 92,
  },
  {
    number: 81,
    round: "R32",
    home: { kind: "winner", group: "D" },
    away: { kind: "third", groups: ["B", "E", "F", "I", "J"], resolved: "B" },
    feedsInto: 94,
  },
  {
    number: 82,
    round: "R32",
    home: { kind: "winner", group: "G" },
    away: { kind: "third", groups: ["A", "E", "H", "I", "J"], resolved: "E" },
    feedsInto: 94,
  },
  {
    number: 83,
    round: "R32",
    home: { kind: "runner", group: "K" },
    away: { kind: "runner", group: "L" },
    feedsInto: 93,
  },
  {
    number: 84,
    round: "R32",
    home: { kind: "winner", group: "H" },
    away: { kind: "runner", group: "J" },
    feedsInto: 93,
  },
  {
    number: 85,
    round: "R32",
    home: { kind: "winner", group: "B" },
    away: { kind: "third", groups: ["E", "F", "G", "I", "J"], resolved: "G" },
    feedsInto: 96,
  },
  {
    number: 86,
    round: "R32",
    home: { kind: "winner", group: "J" },
    away: { kind: "runner", group: "H" },
    feedsInto: 95,
  },
  {
    number: 87,
    round: "R32",
    home: { kind: "winner", group: "K" },
    away: { kind: "third", groups: ["D", "E", "I", "J", "L"], resolved: "D" },
    feedsInto: 96,
  },
  {
    number: 88,
    round: "R32",
    home: { kind: "runner", group: "D" },
    away: { kind: "runner", group: "G" },
    feedsInto: 95,
  },
  {
    number: 89,
    round: "R16",
    home: { kind: "match", match: 74 },
    away: { kind: "match", match: 77 },
    feedsInto: 97,
  },
  {
    number: 90,
    round: "R16",
    home: { kind: "match", match: 73 },
    away: { kind: "match", match: 75 },
    feedsInto: 97,
  },
  {
    number: 91,
    round: "R16",
    home: { kind: "match", match: 76 },
    away: { kind: "match", match: 78 },
    feedsInto: 99,
  },
  {
    number: 92,
    round: "R16",
    home: { kind: "match", match: 79 },
    away: { kind: "match", match: 80 },
    feedsInto: 99,
  },
  {
    number: 93,
    round: "R16",
    home: { kind: "match", match: 83 },
    away: { kind: "match", match: 84 },
    feedsInto: 98,
  },
  {
    number: 94,
    round: "R16",
    home: { kind: "match", match: 81 },
    away: { kind: "match", match: 82 },
    feedsInto: 98,
  },
  {
    number: 95,
    round: "R16",
    home: { kind: "match", match: 86 },
    away: { kind: "match", match: 88 },
    feedsInto: 100,
  },
  {
    number: 96,
    round: "R16",
    home: { kind: "match", match: 85 },
    away: { kind: "match", match: 87 },
    feedsInto: 100,
  },
  {
    number: 97,
    round: "QF",
    home: { kind: "match", match: 89 },
    away: { kind: "match", match: 90 },
    feedsInto: 101,
  },
  {
    number: 98,
    round: "QF",
    home: { kind: "match", match: 93 },
    away: { kind: "match", match: 94 },
    feedsInto: 101,
  },
  {
    number: 99,
    round: "QF",
    home: { kind: "match", match: 91 },
    away: { kind: "match", match: 92 },
    feedsInto: 102,
  },
  {
    number: 100,
    round: "QF",
    home: { kind: "match", match: 95 },
    away: { kind: "match", match: 96 },
    feedsInto: 102,
  },
  {
    number: 101,
    round: "SF",
    home: { kind: "match", match: 97 },
    away: { kind: "match", match: 98 },
    feedsInto: 104,
  },
  {
    number: 102,
    round: "SF",
    home: { kind: "match", match: 99 },
    away: { kind: "match", match: 100 },
    feedsInto: 104,
  },
  {
    number: 103,
    round: "TP",
    home: { kind: "loser", match: 101 },
    away: { kind: "loser", match: 102 },
  },
  {
    number: 104,
    round: "FINAL",
    home: { kind: "match", match: 101 },
    away: { kind: "match", match: 102 },
  },
];

export const knockoutMatches: KnockoutMatch[] = knockoutBracket.map((m) => {
  const s = scheduleByNumber.get(m.number);
  if (!s) throw new Error(`No schedule for match ${m.number}`);
  return { ...m, kickoffAt: s.kickoffAt, venue: s.venue };
});

export const matchByNumber: Record<number, KnockoutMatch> = Object.fromEntries(
  knockoutMatches.map((m) => [m.number, m]),
);

/** A flat per-number schedule for all 104 matches; knockout sides are null
 *  until the bracket resolves. */
export interface ScheduledMatch {
  number: number;
  homeId: string | null;
  awayId: string | null;
  kickoffAt: string;
  venue: string;
}
export const matchSchedule: ScheduledMatch[] = [
  ...groupMatches.map((m) => ({
    number: m.number,
    homeId: m.homeId,
    awayId: m.awayId,
    kickoffAt: m.kickoffAt,
    venue: m.venue,
  })),
  ...knockoutMatches.map((m) => ({
    number: m.number,
    homeId: null,
    awayId: null,
    kickoffAt: m.kickoffAt,
    venue: m.venue,
  })),
].sort((x, y) => x.number - y.number);

// IANA time zone of each host-city stadium, so a kickoff can be shown in the
// venue's own local time when the user asks about the time there.
const venueTimeZones: Record<string, string> = {
  "Atlanta Stadium": "America/New_York",
  "BC Place Vancouver": "America/Vancouver",
  "Boston Stadium": "America/New_York",
  "Dallas Stadium": "America/Chicago",
  "Guadalajara Stadium": "America/Mexico_City",
  "Houston Stadium": "America/Chicago",
  "Kansas City Stadium": "America/Chicago",
  "Los Angeles Stadium": "America/Los_Angeles",
  "Mexico City Stadium": "America/Mexico_City",
  "Miami Stadium": "America/New_York",
  "Monterrey Stadium": "America/Monterrey",
  "New York/New Jersey Stadium": "America/New_York",
  "Philadelphia Stadium": "America/New_York",
  "San Francisco Bay Area Stadium": "America/Los_Angeles",
  "Seattle Stadium": "America/Los_Angeles",
  "Toronto Stadium": "America/Toronto",
};

export function venueTimeZone(venue: string): string | undefined {
  return venueTimeZones[venue];
}

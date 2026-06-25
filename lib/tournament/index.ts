// The 2026 World Cup, as static facts: 48 teams, the 12 groups and their
// round-robin fixtures, and the knockout bracket graph (matches 73–104) with
// schedule and venue metadata. This module queries nothing — it is the single
// source of truth the predictions and results modules build on.

export type GroupLetter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type Round = "R32" | "R16" | "QF" | "SF" | "TP" | "FINAL";

export interface Team {
  id: string; // FIFA 3-letter code, e.g. "MEX"; also keys the flag image
  name: string;
  group: GroupLetter;
}

/** A group-stage round-robin fixture, e.g. "A1".."L6". */
export interface GroupMatch {
  id: string;
  group: GroupLetter;
  matchday: 1 | 2 | 3;
  homeId: string;
  awayId: string;
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
  date: string;
  time: string;
  venue: string;
  city: string;
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

// Round-robin: each group's 4 teams play 6 fixtures across 3 matchdays.
export const groupMatches: GroupMatch[] = groupLetters.flatMap((L) => {
  const [a, b, c, d] = groupTeams[L];
  return [
    { id: `${L}1`, group: L, matchday: 1, homeId: a, awayId: b },
    { id: `${L}2`, group: L, matchday: 1, homeId: c, awayId: d },
    { id: `${L}3`, group: L, matchday: 2, homeId: a, awayId: c },
    { id: `${L}4`, group: L, matchday: 2, homeId: d, awayId: b },
    { id: `${L}5`, group: L, matchday: 3, homeId: d, awayId: a },
    { id: `${L}6`, group: L, matchday: 3, homeId: b, awayId: c },
  ] satisfies GroupMatch[];
});

// The group fixture between two teams (order-independent), or undefined for a
// pair that never meets in the group stage. Used to match live/market data —
// keyed by team ids — back to our fixtures.
const fixtureByPair = new Map(
  groupMatches.map((m) => [[m.homeId, m.awayId].sort().join("|"), m]),
);
export const groupFixture = (a: string, b: string): GroupMatch | undefined =>
  fixtureByPair.get([a, b].sort().join("|"));

// Third-place slots are pre-resolved to one valid group (only 8 of 12 thirds
// advance); the winner/runner/third refs drive both rendering and the model.
export const knockoutMatches: KnockoutMatch[] = [
  {
    number: 73,
    round: "R32",
    home: { kind: "runner", group: "A" },
    away: { kind: "runner", group: "B" },
    feedsInto: 90,
    date: "Jun 28",
    time: "12:00",
    venue: "SoFi Stadium",
    city: "Inglewood",
  },
  {
    number: 74,
    round: "R32",
    home: { kind: "winner", group: "E" },
    away: { kind: "third", groups: ["A", "B", "C", "D", "F"], resolved: "A" },
    feedsInto: 89,
    date: "Jun 29",
    time: "16:30",
    venue: "Gillette Stadium",
    city: "Foxborough",
  },
  {
    number: 75,
    round: "R32",
    home: { kind: "winner", group: "F" },
    away: { kind: "runner", group: "C" },
    feedsInto: 90,
    date: "Jun 29",
    time: "19:00",
    venue: "Estadio BBVA",
    city: "Guadalupe",
  },
  {
    number: 76,
    round: "R32",
    home: { kind: "winner", group: "C" },
    away: { kind: "runner", group: "F" },
    feedsInto: 91,
    date: "Jun 29",
    time: "12:00",
    venue: "NRG Stadium",
    city: "Houston",
  },
  {
    number: 77,
    round: "R32",
    home: { kind: "winner", group: "I" },
    away: { kind: "third", groups: ["C", "D", "F", "G", "H"], resolved: "C" },
    feedsInto: 89,
    date: "Jun 30",
    time: "17:00",
    venue: "MetLife Stadium",
    city: "East Rutherford",
  },
  {
    number: 78,
    round: "R32",
    home: { kind: "runner", group: "E" },
    away: { kind: "runner", group: "I" },
    feedsInto: 91,
    date: "Jun 30",
    time: "12:00",
    venue: "AT&T Stadium",
    city: "Arlington",
  },
  {
    number: 79,
    round: "R32",
    home: { kind: "winner", group: "A" },
    away: { kind: "third", groups: ["C", "E", "F", "H", "I"], resolved: "F" },
    feedsInto: 92,
    date: "Jun 30",
    time: "19:00",
    venue: "Estadio Azteca",
    city: "Mexico City",
  },
  {
    number: 80,
    round: "R32",
    home: { kind: "winner", group: "L" },
    away: { kind: "third", groups: ["E", "H", "I", "J", "K"], resolved: "H" },
    feedsInto: 92,
    date: "Jul 1",
    time: "12:00",
    venue: "Mercedes-Benz Stadium",
    city: "Atlanta",
  },
  {
    number: 81,
    round: "R32",
    home: { kind: "winner", group: "D" },
    away: { kind: "third", groups: ["B", "E", "F", "I", "J"], resolved: "B" },
    feedsInto: 94,
    date: "Jul 1",
    time: "17:00",
    venue: "Levi's Stadium",
    city: "Santa Clara",
  },
  {
    number: 82,
    round: "R32",
    home: { kind: "winner", group: "G" },
    away: { kind: "third", groups: ["A", "E", "H", "I", "J"], resolved: "E" },
    feedsInto: 94,
    date: "Jul 1",
    time: "13:00",
    venue: "Lumen Field",
    city: "Seattle",
  },
  {
    number: 83,
    round: "R32",
    home: { kind: "runner", group: "K" },
    away: { kind: "runner", group: "L" },
    feedsInto: 93,
    date: "Jul 2",
    time: "19:00",
    venue: "BMO Field",
    city: "Toronto",
  },
  {
    number: 84,
    round: "R32",
    home: { kind: "winner", group: "H" },
    away: { kind: "runner", group: "J" },
    feedsInto: 93,
    date: "Jul 2",
    time: "12:00",
    venue: "SoFi Stadium",
    city: "Inglewood",
  },
  {
    number: 85,
    round: "R32",
    home: { kind: "winner", group: "B" },
    away: { kind: "third", groups: ["E", "F", "G", "I", "J"], resolved: "G" },
    feedsInto: 96,
    date: "Jul 2",
    time: "20:00",
    venue: "BC Place",
    city: "Vancouver",
  },
  {
    number: 86,
    round: "R32",
    home: { kind: "winner", group: "J" },
    away: { kind: "runner", group: "H" },
    feedsInto: 95,
    date: "Jul 3",
    time: "18:00",
    venue: "Hard Rock Stadium",
    city: "Miami Gardens",
  },
  {
    number: 87,
    round: "R32",
    home: { kind: "winner", group: "K" },
    away: { kind: "third", groups: ["D", "E", "I", "J", "L"], resolved: "D" },
    feedsInto: 96,
    date: "Jul 3",
    time: "20:30",
    venue: "Arrowhead Stadium",
    city: "Kansas City",
  },
  {
    number: 88,
    round: "R32",
    home: { kind: "runner", group: "D" },
    away: { kind: "runner", group: "G" },
    feedsInto: 95,
    date: "Jul 3",
    time: "13:00",
    venue: "AT&T Stadium",
    city: "Arlington",
  },
  {
    number: 89,
    round: "R16",
    home: { kind: "match", match: 74 },
    away: { kind: "match", match: 77 },
    feedsInto: 97,
    date: "Jul 4",
    time: "17:00",
    venue: "Lincoln Financial Field",
    city: "Philadelphia",
  },
  {
    number: 90,
    round: "R16",
    home: { kind: "match", match: 73 },
    away: { kind: "match", match: 75 },
    feedsInto: 97,
    date: "Jul 4",
    time: "12:00",
    venue: "NRG Stadium",
    city: "Houston",
  },
  {
    number: 91,
    round: "R16",
    home: { kind: "match", match: 76 },
    away: { kind: "match", match: 78 },
    feedsInto: 99,
    date: "Jul 5",
    time: "16:00",
    venue: "MetLife Stadium",
    city: "East Rutherford",
  },
  {
    number: 92,
    round: "R16",
    home: { kind: "match", match: 79 },
    away: { kind: "match", match: 80 },
    feedsInto: 99,
    date: "Jul 5",
    time: "18:00",
    venue: "Estadio Azteca",
    city: "Mexico City",
  },
  {
    number: 93,
    round: "R16",
    home: { kind: "match", match: 83 },
    away: { kind: "match", match: 84 },
    feedsInto: 98,
    date: "Jul 6",
    time: "14:00",
    venue: "AT&T Stadium",
    city: "Arlington",
  },
  {
    number: 94,
    round: "R16",
    home: { kind: "match", match: 81 },
    away: { kind: "match", match: 82 },
    feedsInto: 98,
    date: "Jul 6",
    time: "17:00",
    venue: "Lumen Field",
    city: "Seattle",
  },
  {
    number: 95,
    round: "R16",
    home: { kind: "match", match: 86 },
    away: { kind: "match", match: 88 },
    feedsInto: 100,
    date: "Jul 7",
    time: "12:00",
    venue: "Mercedes-Benz Stadium",
    city: "Atlanta",
  },
  {
    number: 96,
    round: "R16",
    home: { kind: "match", match: 85 },
    away: { kind: "match", match: 87 },
    feedsInto: 100,
    date: "Jul 7",
    time: "13:00",
    venue: "BC Place",
    city: "Vancouver",
  },
  {
    number: 97,
    round: "QF",
    home: { kind: "match", match: 89 },
    away: { kind: "match", match: 90 },
    feedsInto: 101,
    date: "Jul 9",
    time: "16:00",
    venue: "Gillette Stadium",
    city: "Foxborough",
  },
  {
    number: 98,
    round: "QF",
    home: { kind: "match", match: 93 },
    away: { kind: "match", match: 94 },
    feedsInto: 101,
    date: "Jul 10",
    time: "12:00",
    venue: "SoFi Stadium",
    city: "Inglewood",
  },
  {
    number: 99,
    round: "QF",
    home: { kind: "match", match: 91 },
    away: { kind: "match", match: 92 },
    feedsInto: 102,
    date: "Jul 11",
    time: "17:00",
    venue: "Hard Rock Stadium",
    city: "Miami Gardens",
  },
  {
    number: 100,
    round: "QF",
    home: { kind: "match", match: 95 },
    away: { kind: "match", match: 96 },
    feedsInto: 102,
    date: "Jul 11",
    time: "20:00",
    venue: "Arrowhead Stadium",
    city: "Kansas City",
  },
  {
    number: 101,
    round: "SF",
    home: { kind: "match", match: 97 },
    away: { kind: "match", match: 98 },
    feedsInto: 104,
    date: "Jul 14",
    time: "14:00",
    venue: "AT&T Stadium",
    city: "Arlington",
  },
  {
    number: 102,
    round: "SF",
    home: { kind: "match", match: 99 },
    away: { kind: "match", match: 100 },
    feedsInto: 104,
    date: "Jul 15",
    time: "15:00",
    venue: "Mercedes-Benz Stadium",
    city: "Atlanta",
  },
  {
    number: 103,
    round: "TP",
    home: { kind: "loser", match: 101 },
    away: { kind: "loser", match: 102 },
    date: "Jul 18",
    time: "17:00",
    venue: "Hard Rock Stadium",
    city: "Miami Gardens",
  },
  {
    number: 104,
    round: "FINAL",
    home: { kind: "match", match: 101 },
    away: { kind: "match", match: 102 },
    date: "Jul 19",
    time: "15:00",
    venue: "MetLife Stadium",
    city: "East Rutherford",
  },
];

export const matchByNumber: Record<number, KnockoutMatch> = Object.fromEntries(
  knockoutMatches.map((m) => [m.number, m]),
);

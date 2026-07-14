// World Cup stages from openfootball/worldcup.json (CC0, public domain).
// martj42 has every match but not the round it was played in; this adds
// "Final", "Semi-finals", etc. so questions about reaching a stage work.

const EDITIONS = [
  1930, 1934, 1938, 1950, 1954, 1958, 1962, 1966, 1970, 1974, 1978, 1982, 1986,
  1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026,
];

export interface StageRow {
  date: string;
  team1: string;
  team2: string;
  stage: string;
}

interface CupFile {
  matches: {
    round: string;
    date: string;
    team1: string;
    team2: string;
    score?: { ft?: [number, number] };
  }[];
}

// Normalize the common round labels ("Matchday 3", "Match for third place",
// "Quarter-finals, Replays"). Anything else stays verbatim — 1950's "Final
// Round" was a round-robin group, not a final, and pretending otherwise would
// answer stage questions wrong.
function stageFor(round: string): string {
  const r = round.toLowerCase();
  if (r.startsWith("matchday") || r.startsWith("group")) return "Group stage";
  if (r.includes("third")) return "Third place";
  if (r.includes("semi")) return "Semi-finals";
  if (r.includes("quarter")) return "Quarter-finals";
  if (r.includes("round of 32")) return "Round of 32";
  if (r.includes("round of 16")) return "Round of 16";
  if (r === "final") return "Final";
  return round;
}

export async function fetchStages(): Promise<StageRow[]> {
  const cups = await Promise.all(
    EDITIONS.map(async (year) => {
      const url = `https://raw.githubusercontent.com/openfootball/worldcup.json/master/${year}/worldcup.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
      const { matches } = (await res.json()) as CupFile;
      // Played matches only: an in-progress edition (2026) lists future
      // fixtures too, and those have no result to attach a stage to yet.
      return matches
        .filter((m) => m.score?.ft)
        .map((m) => ({
          date: m.date,
          team1: m.team1,
          team2: m.team2,
          stage: stageFor(m.round),
        }));
    }),
  );
  return cups.flat();
}

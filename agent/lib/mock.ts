import type { GroupCardProps } from "@/components/widgets/group-card";
import type { MatchWidgetProps } from "@/components/widgets/match-widget";

// MOCK DATA — hard-coded fixtures so the widgets and their tools can be
// exercised without any data fetching, standings math, or prediction logic.
// This is the one intentional shortcut; swap these factories for real sources
// later without touching the widgets or tools.

// Flags come straight from flagcdn.com by ISO 3166-1 code (e.g. "br",
// "gb-sct") — no assets or dependencies on our side.
const flag = (code: string) => `https://flagcdn.com/w80/${code}.png`;

const matches: MatchWidgetProps[] = [
  {
    number: 49,
    phaseLabel: "Group A",
    status: "live",
    live: true,
    detail: "58'",
    home: { code: "SCO", name: "Scotland", flagSrc: flag("gb-sct"), score: 0 },
    away: { code: "BRA", name: "Brazil", flagSrc: flag("br"), score: 2 },
    prediction: { homeWin: 0.04, awayWin: 0.96 },
  },
  {
    number: 50,
    phaseLabel: "Group A",
    status: "final",
    home: {
      code: "BRA",
      name: "Brazil",
      flagSrc: flag("br"),
      score: 2,
      winner: true,
    },
    away: {
      code: "RSA",
      name: "South Africa",
      flagSrc: flag("za"),
      score: 0,
      winner: false,
    },
  },
  {
    number: 54,
    phaseLabel: "Group A",
    status: "scheduled",
    kickoff: "JUL 22, 12hs",
    home: { code: "RSA", name: "South Africa", flagSrc: flag("za") },
    away: { code: "KOR", name: "South Korea", flagSrc: flag("kr") },
    prediction: { homeWin: 0.42, awayWin: 0.58 },
  },
  {
    number: 98,
    phaseLabel: "Round of 16",
    status: "scheduled",
    kickoff: "JUL 5, 16hs",
    home: { code: "ARG", name: "Argentina", flagSrc: flag("ar") },
    away: { code: "FRA", name: "France", flagSrc: flag("fr") },
    prediction: { homeWin: 0.51, awayWin: 0.49 },
  },
];

const KNOCKOUT_PHASE_LABELS: Record<string, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarterfinal: "Quarterfinal",
  semifinal: "Semifinal",
  final: "Final",
};

export type MatchPhase = "group" | keyof typeof KNOCKOUT_PHASE_LABELS;

export function mockMatch({
  number,
  phase,
}: {
  number?: number;
  phase?: MatchPhase;
} = {}): MatchWidgetProps {
  if (number != null) {
    const byNumber = matches.find((match) => match.number === number);
    if (byNumber) return byNumber;
  }
  if (phase === "group") {
    const group = matches.find((match) =>
      match.phaseLabel?.startsWith("Group"),
    );
    if (group) return group;
  } else if (phase) {
    const label = KNOCKOUT_PHASE_LABELS[phase];
    const byPhase = matches.find((match) => match.phaseLabel === label);
    if (byPhase) return byPhase;
  }
  return matches[0];
}

const GROUP_A: Omit<GroupCardProps, "title"> = {
  columns: ["BRA", "SCO", "RSA", "KOR"],
  rows: [
    {
      position: 1,
      team: {
        code: "BRA",
        name: "Brazil",
        flagSrc: flag("br"),
        confirmed: true,
      },
      goalDiff: "+5",
      points: 9,
      marker: "advance",
      cells: [
        null,
        { text: "2–0", status: "final", title: "Brazil vs Scotland — final" },
        {
          text: "3–1",
          status: "predicted",
          title: "Brazil vs South Africa — predicted",
        },
        {
          text: "1–0",
          status: "live",
          title: "Brazil vs South Korea — live",
        },
      ],
    },
    {
      position: 2,
      team: { code: "SCO", name: "Scotland", flagSrc: flag("gb-sct") },
      goalDiff: "+1",
      points: 6,
      marker: "advance",
      cells: [
        { text: "0–2", status: "final", title: "Scotland vs Brazil — final" },
        null,
        {
          text: "2–1",
          status: "predicted",
          title: "Scotland vs South Africa — predicted",
        },
        {
          text: "1–0",
          status: "predicted",
          title: "Scotland vs South Korea — predicted",
        },
      ],
    },
    {
      position: 3,
      team: { code: "RSA", name: "South Africa", flagSrc: flag("za") },
      goalDiff: "-2",
      points: 3,
      marker: "third",
      cells: [
        {
          text: "1–3",
          status: "predicted",
          title: "South Africa vs Brazil — predicted",
        },
        {
          text: "1–2",
          status: "predicted",
          title: "South Africa vs Scotland — predicted",
        },
        null,
        {
          text: "2–0",
          status: "final",
          title: "South Africa vs South Korea — final",
        },
      ],
    },
    {
      position: 4,
      team: { code: "KOR", name: "South Korea", flagSrc: flag("kr") },
      dimmed: true,
      goalDiff: "-4",
      points: 0,
      marker: "none",
      cells: [
        {
          text: "0–1",
          status: "live",
          title: "South Korea vs Brazil — live",
        },
        {
          text: "0–1",
          status: "predicted",
          title: "South Korea vs Scotland — predicted",
        },
        {
          text: "0–2",
          status: "final",
          title: "South Korea vs South Africa — final",
        },
        null,
      ],
    },
  ],
};

export function mockGroup(group?: string): GroupCardProps {
  const letter = (group ?? "A").toUpperCase();
  return { title: `Group ${letter}`, ...GROUP_A };
}

// Temporary debug page: visual preview of GroupCard across confirmed / live /
// predicted situations with fake data. Remove once the visual language is settled.

import { Info } from "lucide-react";

import { CardGrid } from "@/components/ui/card-grid";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { GroupCard } from "@/components/widgets/group-card";

type Status = "final" | "live" | "predicted";
type Marker = "advance" | "third" | "none";

interface FakeMatch {
  home: string;
  away: string;
  h: number;
  a: number;
  status: Status;
}

interface FakeTeam {
  code: string;
  name?: string;
}

interface FakeGroup {
  title: string;
  teams: FakeTeam[];
  matches: FakeMatch[];
}

const counts = (m: FakeMatch) => m.status !== "predicted";
const blank = () => ({ points: 0, gf: 0, ga: 0 });

function buildGroup(group: FakeGroup) {
  const codes = group.teams.map((t) => t.code);
  const seed = new Map(codes.map((c, i) => [c, i]));
  const stat = new Map(codes.map((c) => [c, blank()]));
  const statOf = (c: string) => stat.get(c) ?? blank();

  for (const m of group.matches) {
    if (!counts(m)) continue;
    const home = stat.get(m.home);
    const away = stat.get(m.away);
    if (!home || !away) continue;
    home.gf += m.h;
    home.ga += m.a;
    away.gf += m.a;
    away.ga += m.h;
    if (m.h > m.a) home.points += 3;
    else if (m.a > m.h) away.points += 3;
    else {
      home.points++;
      away.points++;
    }
  }

  const gdOf = (c: string) => statOf(c).gf - statOf(c).ga;
  const order = [...codes].sort(
    (x, y) =>
      statOf(y).points - statOf(x).points ||
      gdOf(y) - gdOf(x) ||
      statOf(y).gf - statOf(x).gf ||
      (seed.get(x) ?? 0) - (seed.get(y) ?? 0),
  );

  const teamOf = new Map(group.teams.map((t) => [t.code, t]));
  const matchOf = (x: string, y: string) =>
    group.matches.find(
      (m) => (m.home === x && m.away === y) || (m.home === y && m.away === x),
    );

  const rows = order.map((code, index) => {
    const gd = gdOf(code);
    return {
      position: index + 1,
      team: {
        code,
        name: teamOf.get(code)?.name,
      },
      dimmed: index >= 3,
      goalDiff: gd > 0 ? `+${gd}` : String(gd),
      points: statOf(code).points,
      marker: (index < 2
        ? "advance"
        : index === 2
          ? "third"
          : "none") as Marker,
      cells: order.map((col) => {
        if (col === code) return null;
        const m = matchOf(code, col);
        if (!m) return undefined;
        const rowIsHome = m.home === code;
        const rowGoals = rowIsHome ? m.h : m.a;
        const colGoals = rowIsHome ? m.a : m.h;
        return {
          text: `${rowGoals}–${colGoals}`,
          title: `${code} vs ${col} — ${m.status}`,
          status: m.status,
        };
      }),
    };
  });

  return { title: group.title, columns: order, rows };
}

const NOT_STARTED: FakeGroup = {
  title: "A — Not started (all predicted)",
  teams: [{ code: "ESP" }, { code: "CRO" }, { code: "MAR" }, { code: "JPN" }],
  matches: [
    { home: "ESP", away: "CRO", h: 2, a: 1, status: "predicted" },
    { home: "ESP", away: "MAR", h: 2, a: 0, status: "predicted" },
    { home: "ESP", away: "JPN", h: 1, a: 0, status: "predicted" },
    { home: "CRO", away: "MAR", h: 1, a: 1, status: "predicted" },
    { home: "CRO", away: "JPN", h: 1, a: 0, status: "predicted" },
    { home: "MAR", away: "JPN", h: 1, a: 1, status: "predicted" },
  ],
};

const MATCHDAY_ONE: FakeGroup = {
  title: "B — Matchday 1 played, rest predicted",
  teams: [{ code: "GER" }, { code: "BEL" }, { code: "SUI" }, { code: "USA" }],
  matches: [
    { home: "GER", away: "USA", h: 3, a: 1, status: "final" },
    { home: "BEL", away: "SUI", h: 1, a: 1, status: "final" },
    { home: "GER", away: "SUI", h: 2, a: 1, status: "predicted" },
    { home: "BEL", away: "USA", h: 2, a: 0, status: "predicted" },
    { home: "GER", away: "BEL", h: 1, a: 1, status: "predicted" },
    { home: "SUI", away: "USA", h: 1, a: 0, status: "predicted" },
  ],
};

const HAS_LIVE: FakeGroup = {
  title: "C — With a live match",
  teams: [{ code: "FRA" }, { code: "NOR" }, { code: "SEN" }, { code: "AUS" }],
  matches: [
    { home: "FRA", away: "AUS", h: 2, a: 0, status: "final" },
    { home: "NOR", away: "SEN", h: 0, a: 0, status: "final" },
    { home: "FRA", away: "SEN", h: 1, a: 1, status: "live" },
    { home: "NOR", away: "AUS", h: 1, a: 0, status: "predicted" },
    { home: "FRA", away: "NOR", h: 2, a: 1, status: "predicted" },
    { home: "SEN", away: "AUS", h: 1, a: 0, status: "predicted" },
  ],
};

const FINISHED: FakeGroup = {
  title: "D — Finished group",
  teams: [{ code: "ARG" }, { code: "MEX" }, { code: "KOR" }, { code: "AUS" }],
  matches: [
    { home: "ARG", away: "AUS", h: 2, a: 0, status: "final" },
    { home: "MEX", away: "KOR", h: 1, a: 0, status: "final" },
    { home: "ARG", away: "KOR", h: 3, a: 1, status: "final" },
    { home: "MEX", away: "AUS", h: 2, a: 1, status: "final" },
    { home: "ARG", away: "MEX", h: 1, a: 1, status: "final" },
    { home: "KOR", away: "AUS", h: 2, a: 2, status: "final" },
  ],
};

const LEADER_PREDICTED_TO_FALL: FakeGroup = {
  title: "E — Real leader, predicted to fall",
  teams: [{ code: "BRA" }, { code: "POR" }, { code: "NED" }, { code: "URU" }],
  matches: [
    { home: "BRA", away: "URU", h: 2, a: 0, status: "final" },
    { home: "POR", away: "NED", h: 1, a: 2, status: "final" },
    { home: "BRA", away: "POR", h: 0, a: 2, status: "predicted" },
    { home: "NED", away: "URU", h: 2, a: 1, status: "predicted" },
    { home: "BRA", away: "NED", h: 0, a: 1, status: "predicted" },
    { home: "POR", away: "URU", h: 2, a: 0, status: "predicted" },
  ],
};

const SCENARIOS = [
  NOT_STARTED,
  MATCHDAY_ONE,
  HAS_LIVE,
  FINISHED,
  LEADER_PREDICTED_TO_FALL,
];

export default function DebugPage() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl space-y-3 px-3 py-3 sm:px-4">
        <Notice icon={Info} tone="amber">
          Temporary debug page. White = confirmed (real points and results),
          grey = predicted (speculative), live = white text with a red pulse.
        </Notice>
        <Section title="Group widget — situations">
          <CardGrid>
            {SCENARIOS.map((scenario) => {
              const { title, columns, rows } = buildGroup(scenario);
              return (
                <GroupCard
                  key={title}
                  title={title}
                  columns={columns}
                  rows={rows}
                />
              );
            })}
          </CardGrid>
        </Section>
      </div>
    </main>
  );
}

"use client";

import { cn } from "cnfast";
import { Info, Trophy } from "lucide-react";
import { useState } from "react";

import { Flag } from "@/components/flags";
import {
  type BracketSlot,
  MatchCard,
  type SlotLookup,
} from "@/components/widgets/bracket-card";
import { type KnockoutMatch, matchByNumber } from "@/lib/tournament";

// The knockout bracket folded into a circle: every match is one of the app's
// MatchCard subcards, the Round-of-32 on the outer ring and each round nested
// one ring inward, the champion in the centre. Geometry is computed once in a
// 1000×1000 space (the SVG viewBox the connectors use); the cards overlay as
// HTML positioned by percentage, so the whole thing scales with the square.

const SIZE = 1000;
const C = SIZE / 2;

// Each half spans 180°−2·GAP, leaving a GAP wedge at top and bottom so the two
// halves read apart and the finalists meet on the horizontal centre axis.
const GAP = 18;
type RoundKey = "R32" | "R16" | "QF" | "SF";
// One ring per round; the outer ring nearly fills the square so the bracket
// reads big while the cards themselves stay packed tight.
const RING: Record<RoundKey, number> = { R32: 426, R16: 306, QF: 188, SF: 98 };
const CHILD_ROUND: Record<Exclude<RoundKey, "R32">, RoundKey> = {
  R16: "R32",
  QF: "R16",
  SF: "QF",
};

const LEFT = { root: 101, start: 180 + GAP, end: 360 - GAP };
const RIGHT = { root: 102, start: GAP, end: 180 - GAP };

// Round coordinates to a fixed precision: trig can differ in the last ULP
// between the server and browser JS engines, and the raw floats would otherwise
// hydrate with a mismatched `d`/position string.
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A point on the ring of radius `r` at `deg` clockwise from the top. */
function polar(deg: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: round2(C + r * Math.sin(rad)), y: round2(C - r * Math.cos(rad)) };
}

/** SVG arc along radius `r` from `a1` to `a2` (the bar joining a node's two
 *  children), drawn clockwise. */
function arcPath(r: number, a1: number, a2: number): string {
  const [s, e] = a1 <= a2 ? [a1, a2] : [a2, a1];
  const p1 = polar(s, r);
  const p2 = polar(e, r);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
}

/** The two feeding matches of a knockout node, or `null` for a Round-of-32 leaf
 *  (whose sides come from groups, not earlier matches). */
function childMatches(m: KnockoutMatch): [number, number] | null {
  if (m.home.kind === "match" && m.away.kind === "match")
    return [m.home.match, m.away.match];
  return null;
}

/** The R32 matches under a half-root, in DFS order — the order they wrap around
 *  the arc so the tree never crosses itself. */
function leafMatches(root: number): number[] {
  const out: number[] = [];
  const visit = (n: number) => {
    const kids = childMatches(matchByNumber[n]);
    if (kids) {
      visit(kids[0]);
      visit(kids[1]);
    } else {
      out.push(n);
    }
  };
  visit(root);
  return out;
}

// One straight connector. `owner` is the match whose winner flows along it, so
// the card can light up the champion's path.
interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  owner: number;
}
interface CardPos {
  match: number;
  x: number;
  y: number;
  mirror: boolean;
}
interface Geometry {
  cards: CardPos[];
  segs: Seg[];
  arcs: string[];
}

/** Angles for every match under a half-root: the R32 leaves spread evenly
 *  across the arc, each inner match centred between its two children. */
function halfAngles(root: number, start: number, end: number) {
  const leaves = leafMatches(root);
  const step = (end - start) / leaves.length;
  const angle = new Map<number, number>();
  leaves.forEach((n, i) => {
    angle.set(n, start + (i + 0.5) * step);
  });
  const visit = (n: number): number => {
    if (angle.has(n)) return angle.get(n)!;
    const [a, b] = childMatches(matchByNumber[n])!;
    const mid = (visit(a) + visit(b)) / 2;
    angle.set(n, mid);
    return mid;
  };
  visit(root);
  return angle;
}

/** Build the skeleton: a card per match and the connectors between each match
 *  and the two it feeds from. Computed once at module load. */
function buildGeometry(): Geometry {
  const cards: CardPos[] = [];
  const segs: Seg[] = [];
  const arcs: string[] = [];
  const sfAngle = new Map<number, number>();

  for (const { root, start, end } of [LEFT, RIGHT]) {
    const mirror = root === RIGHT.root; // flags face outward on each side
    const angle = halfAngles(root, start, end);

    for (const [num, ang] of angle) {
      const m = matchByNumber[num];
      const round = m.round as RoundKey;
      const rN = RING[round];
      cards.push({ match: num, ...polar(ang, rN), mirror });
      if (num === root) sfAngle.set(num, ang);

      const kids = childMatches(m);
      if (!kids) continue;
      // Parent stem out to a bus between the rings, the bar across it, then a
      // spoke down to each child card.
      const rChild = RING[CHILD_ROUND[round as Exclude<RoundKey, "R32">]];
      const rBus = round2((rN + rChild) / 2);
      const stem = polar(ang, rBus);
      segs.push({
        x1: polar(ang, rN).x,
        y1: polar(ang, rN).y,
        x2: stem.x,
        y2: stem.y,
        owner: num,
      });
      arcs.push(arcPath(rBus, angle.get(kids[0])!, angle.get(kids[1])!));
      for (const cm of kids) {
        const ca = angle.get(cm)!;
        const a = polar(ca, rBus);
        const b = polar(ca, rChild);
        segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, owner: cm });
      }
    }
  }

  // The final: each semi runs straight to the centre, where the champion sits.
  for (const sf of [LEFT.root, RIGHT.root]) {
    const p = polar(sfAngle.get(sf)!, RING.SF);
    segs.push({ x1: C, y1: C, x2: p.x, y2: p.y, owner: sf });
  }

  return { cards, segs, arcs };
}

const GEOMETRY = buildGeometry();

/** The predicted state the card paints onto the skeleton. */
export interface CircularBracketView {
  getSlot: SlotLookup; // a match side's predicted team + its chance to win
  winner: Map<number, BracketSlot>; // match number → predicted advancing team
  champion?: BracketSlot;
}

const pct = (v: number) => `${(v / SIZE) * 100}%`;
const formatPct = (p?: number) =>
  p === undefined ? "··" : `${Math.round(p * 100)}%`;

function Connectors({ view }: { view?: CircularBracketView }) {
  const champ = view?.champion?.code;
  const onChampPath = (owner: number) =>
    champ != null && view?.winner.get(owner)?.code === champ;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative connectors; structure is conveyed by the labelled cards it links.
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      {GEOMETRY.arcs.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth={2.5}
        />
      ))}
      {GEOMETRY.segs.map((s, i) => {
        const on = onChampPath(s.owner);
        return (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is static
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={on ? "var(--pick)" : "var(--border-strong)"}
            strokeWidth={on ? 4 : 2.5}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** A match subcard pinned at its node, centred on (x, y). Opaque, so it masks
 *  the connectors that pass behind it — just like the linear bracket. */
function PositionedMatch({
  pos,
  view,
}: {
  pos: CardPos;
  view?: CircularBracketView;
}) {
  const onPath =
    view?.champion?.code != null &&
    view.winner.get(pos.match)?.code === view.champion.code;
  return (
    <div
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 rounded-[4px]",
        onPath && "ring-1 ring-pick",
      )}
      style={{ left: pct(pos.x), top: pct(pos.y), width: "var(--card)" }}
    >
      <MatchCard
        number={pos.match}
        getSlot={view?.getSlot ?? (() => undefined)}
        mirror={pos.mirror}
      />
    </div>
  );
}

/** The predicted champion at the centre, in the app's champion-card idiom: a
 *  trophy, the flag, the full name in the pick colour, and the title odds. */
function ChampionChip({ view }: { view?: CircularBracketView }) {
  const champ = view?.champion;
  return (
    <div
      className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-xl border border-pick/40 bg-card px-2.5 py-1.5 shadow-lg ring-1 ring-pick/10"
      style={{ left: "50%", top: "50%" }}
    >
      <Trophy
        className={cn(
          "size-4",
          champ ? "text-pick" : "text-muted-foreground/40",
        )}
      />
      <Flag
        code={champ?.code}
        size="var(--flag)"
        className="block rounded-full"
      />
      <span className="text-[11px] font-semibold text-pick">
        {champ?.name ?? champ?.code ?? "—"}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {formatPct(champ?.probability)}
      </span>
    </div>
  );
}

const HELP_TEXT =
  "The knockout bracket folded into a circle: the Round-of-32 on the outside, each round nested one ring inward, the champion in the centre. The number by a flag is that team's chance to win that match; the highlighted line is the predicted champion's road to the title.";

/** Header info affordance — a popover on tap (native `title` is hover-only). */
function CircularBracketHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="How to read this bracket"
        aria-expanded={open}
        className="flex cursor-pointer items-center text-muted-foreground/55 transition-colors hover:text-muted-foreground"
      >
        <Info className="size-3.5" />
      </button>
      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full right-0 z-20 mt-1.5 w-64 rounded-md border border-surface-border bg-surface-2 p-2 text-[10px] leading-relaxed text-muted-foreground shadow-lg">
            {HELP_TEXT}
          </div>
        </>
      )}
    </div>
  );
}

/** The knockout bracket as a circle of our match subcards: the structure
 *  renders immediately, picks and the champion's path fill in with the market. */
export function CircularBracketCard({ view }: { view?: CircularBracketView }) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center gap-1.5 border-b border-surface-divider px-3">
        <span className="shrink-0 text-[11px] font-medium tracking-wide text-foreground/70">
          Prediction bracket
        </span>
        <span className="min-w-0 truncate text-[10px] text-muted-foreground/55">
          · each team's chance to win its match
        </span>
        <CircularBracketHelp />
      </div>
      {/* Below the min-width the circle would cram, so it scrolls instead. */}
      <div className="overflow-x-auto px-3 py-4">
        <div className="relative mx-auto aspect-square w-full min-w-[440px] max-w-[680px] [--card:calc(var(--flag)+var(--pct)+8px)] [--flag:13px] [--pct:16px] sm:[--flag:15px] sm:[--pct:18px] lg:[--flag:16px] lg:[--pct:20px]">
          <Connectors view={view} />
          {GEOMETRY.cards.map((pos) => (
            <PositionedMatch key={pos.match} pos={pos} view={view} />
          ))}
          <ChampionChip view={view} />
        </div>
      </div>
    </div>
  );
}

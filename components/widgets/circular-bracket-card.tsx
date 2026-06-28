"use client";

import { cn } from "cnfast";
import { Info, Trophy } from "lucide-react";
import { useState } from "react";

import { Flag } from "@/components/flags";
import type { BracketSlot } from "@/components/widgets/bracket-card";
import { type KnockoutMatch, matchByNumber } from "@/lib/tournament";

// The bracket drawn as a radial dendrogram: 32 team flags on the outer ring,
// connectors spiralling inward through one ring per round, the champion in the
// centre. Geometry is computed once in a 1000×1000 space (the SVG viewBox); the
// flags overlay as HTML positioned by percentage, so the whole thing scales with
// the square container. Data only colours this fixed skeleton.

const SIZE = 1000;
const C = SIZE / 2;

// Each half spans 180°−2·GAP, leaving a GAP wedge at the top and bottom so the
// two halves read apart and the finalists meet on the horizontal centre axis.
const GAP = 18;
const R_LABEL = 450; // outermost band: each team's chance label
const R_FLAG = 404; // ring of the 32 team flags
type RoundKey = "R32" | "R16" | "QF" | "SF";
const RING: Record<RoundKey, number> = { R32: 308, R16: 228, QF: 150, SF: 78 };
const CHILD_ROUND: Record<Exclude<RoundKey, "R32">, RoundKey> = {
  R16: "R32",
  QF: "R16",
  SF: "QF",
};

const LEFT = { root: 101, start: 180 + GAP, end: 360 - GAP };
const RIGHT = { root: 102, start: GAP, end: 180 - GAP };

type Side = "home" | "away";

// Round coordinates to a fixed precision: trig can differ in the last ULP
// between the server and browser JS engines, and the raw floats would otherwise
// hydrate with a mismatched `d`/position string.
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A point on the ring of radius `r` at `deg` clockwise from the top. */
function polar(deg: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: round2(C + r * Math.sin(rad)), y: round2(C - r * Math.cos(rad)) };
}

/** SVG arc along radius `r` from `a1` to `a2` (the bar that joins two children
 *  of a node), drawn clockwise. */
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

/** The R32 leaf slots under a half-root, in DFS order — the order they wrap
 *  around the arc, each match's home flag then its away flag. */
function leafSlots(root: number): { match: number; side: Side }[] {
  const out: { match: number; side: Side }[] = [];
  const visit = (n: number) => {
    const kids = childMatches(matchByNumber[n]);
    if (kids) {
      visit(kids[0]);
      visit(kids[1]);
    } else {
      out.push({ match: n, side: "home" }, { match: n, side: "away" });
    }
  };
  visit(root);
  return out;
}

// Outer endpoint of a spoke — what advancing through it means, so the card can
// light up the champion's path: a flag (an R32 side) or an inner match winner.
type Outer =
  | { kind: "flag"; match: number; side: Side }
  | { kind: "match"; match: number };

interface Spoke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  outer: Outer;
}
interface FlagPos {
  match: number;
  side: Side;
  x: number;
  y: number;
  lx: number; // chance-label position (just outside the flag)
  ly: number;
}
interface NodeDot {
  match: number;
  x: number;
  y: number;
}

interface Geometry {
  flags: FlagPos[];
  spokes: Spoke[];
  arcs: string[];
  dots: NodeDot[];
}

/** Angles for every node under a half-root: leaves spread evenly across the
 *  arc, each inner node centred between its two children. */
function halfAngles(root: number, start: number, end: number) {
  const leaves = leafSlots(root);
  const step = (end - start) / leaves.length;
  const flagAngle = new Map<string, number>();
  leaves.forEach((lf, i) => {
    flagAngle.set(`${lf.match}:${lf.side}`, start + (i + 0.5) * step);
  });
  const nodeAngle = new Map<number, number>();
  const visit = (n: number): number => {
    const kids = childMatches(matchByNumber[n]);
    const a = kids
      ? (visit(kids[0]) + visit(kids[1])) / 2
      : (flagAngle.get(`${n}:home`)! + flagAngle.get(`${n}:away`)!) / 2;
    nodeAngle.set(n, a);
    return a;
  };
  visit(root);
  return { leaves, flagAngle, nodeAngle };
}

/** Build the whole skeleton: both halves of the tree plus the final's spokes
 *  meeting in the centre. Computed once at module load. */
function buildGeometry(): Geometry {
  const flags: FlagPos[] = [];
  const spokes: Spoke[] = [];
  const arcs: string[] = [];
  const dots: NodeDot[] = [];
  const sfAngle = new Map<number, number>();

  for (const { root, start, end } of [LEFT, RIGHT]) {
    const { leaves, flagAngle, nodeAngle } = halfAngles(root, start, end);

    for (const lf of leaves) {
      const a = flagAngle.get(`${lf.match}:${lf.side}`)!;
      const label = polar(a, R_LABEL);
      flags.push({ ...lf, ...polar(a, R_FLAG), lx: label.x, ly: label.y });
    }

    for (const [num, ang] of nodeAngle) {
      const m = matchByNumber[num];
      const round = m.round as RoundKey;
      const rN = RING[round];
      dots.push({ match: num, ...polar(ang, rN) });
      if (num === root) sfAngle.set(num, ang);

      const kids = childMatches(m);
      if (!kids) {
        // R32 leaf: a spoke out to each flag, the arc joining the two flags.
        for (const side of ["home", "away"] as Side[]) {
          const fa = flagAngle.get(`${num}:${side}`)!;
          const inner = polar(fa, rN);
          const outer = polar(fa, R_FLAG);
          spokes.push({
            x1: inner.x,
            y1: inner.y,
            x2: outer.x,
            y2: outer.y,
            outer: { kind: "flag", match: num, side },
          });
        }
        arcs.push(
          arcPath(
            rN,
            flagAngle.get(`${num}:home`)!,
            flagAngle.get(`${num}:away`)!,
          ),
        );
      } else {
        const rChild = RING[CHILD_ROUND[round as Exclude<RoundKey, "R32">]];
        for (const cm of kids) {
          const ca = nodeAngle.get(cm)!;
          const inner = polar(ca, rN);
          const outer = polar(ca, rChild);
          spokes.push({
            x1: inner.x,
            y1: inner.y,
            x2: outer.x,
            y2: outer.y,
            outer: { kind: "match", match: cm },
          });
        }
        arcs.push(
          arcPath(rN, nodeAngle.get(kids[0])!, nodeAngle.get(kids[1])!),
        );
      }
    }
  }

  // The final: each semi runs straight to the centre, forming the horizontal
  // axis the champion chip sits on.
  for (const sf of [LEFT.root, RIGHT.root]) {
    const outer = polar(sfAngle.get(sf)!, RING.SF);
    spokes.push({
      x1: C,
      y1: C,
      x2: outer.x,
      y2: outer.y,
      outer: { kind: "match", match: sf },
    });
  }

  return { flags, spokes, arcs, dots };
}

const GEOMETRY = buildGeometry();

/** The predicted state the card paints onto the skeleton. */
export interface CircularBracketView {
  slots: Map<string, BracketSlot>; // "match:side" → predicted team
  winner: Map<number, BracketSlot>; // match number → predicted advancing team
  win: Map<string, number>; // "match:code" → chance that team wins the match
  champion?: BracketSlot;
}

const pct = (v: number) => `${(v / SIZE) * 100}%`;

/** The team a spoke's outer end carries forward, or undefined while loading. */
function outerCode(view: CircularBracketView | undefined, outer: Outer) {
  if (!view) return undefined;
  return outer.kind === "flag"
    ? view.slots.get(`${outer.match}:${outer.side}`)?.code
    : view.winner.get(outer.match)?.code;
}

function Connectors({ view }: { view?: CircularBracketView }) {
  const champ = view?.champion?.code;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative connectors; structure is conveyed by the labelled flags it links.
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
      {GEOMETRY.spokes.map((s, i) => {
        const onPath = champ != null && outerCode(view, s.outer) === champ;
        return (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is static
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={onPath ? "var(--pick)" : "var(--border-strong)"}
            strokeWidth={onPath ? 4 : 2.5}
            strokeLinecap="round"
          />
        );
      })}
      {GEOMETRY.dots.map((dot) => {
        const onPath =
          champ != null && view?.winner.get(dot.match)?.code === champ;
        return (
          <circle
            key={dot.match}
            cx={dot.x}
            cy={dot.y}
            r={onPath ? 7 : 5}
            fill={onPath ? "var(--pick)" : "var(--border-strong)"}
          />
        );
      })}
    </svg>
  );
}

/** One outer team: its flag on the flag ring and, just outside it, the chance
 *  that team reaches this Round-of-32 match. The predicted loser of the pair is
 *  dimmed; the champion's flag is ringed. */
function FlagNode({ pos, view }: { pos: FlagPos; view?: CircularBracketView }) {
  const slot = view?.slots.get(`${pos.match}:${pos.side}`);
  const winner = view?.winner.get(pos.match)?.code;
  const isChampion = slot?.code != null && slot.code === view?.champion?.code;
  const dim = winner != null && slot?.code != null && slot.code !== winner;
  // The chance this team wins its opening match (advances a ring) — far more
  // telling than its near-certain chance of merely being here.
  const p = slot?.code ? view?.win.get(`${pos.match}:${slot.code}`) : undefined;
  return (
    <>
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: pct(pos.x), top: pct(pos.y) }}
      >
        <Flag
          code={slot?.code}
          size="var(--cf)"
          className={cn(
            "block rounded-full",
            dim && "opacity-40",
            isChampion && "ring-2 ring-pick",
          )}
        />
      </div>
      <span
        className={cn(
          "absolute -translate-x-1/2 -translate-y-1/2 text-[10px] leading-none tabular-nums sm:text-[11px] lg:text-xs",
          isChampion
            ? "font-semibold text-pick"
            : dim
              ? "text-muted-foreground/55"
              : "font-semibold text-foreground/80",
        )}
        style={{ left: pct(pos.lx), top: pct(pos.ly) }}
      >
        {p === undefined ? "··" : `${Math.round(p * 100)}%`}
      </span>
    </>
  );
}

function ChampionChip({ view }: { view?: CircularBracketView }) {
  const champ = view?.champion;
  const p = champ?.probability;
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: "50%", top: "50%" }}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-pick/40 bg-surface-2 px-2 py-1 shadow-lg">
        <Trophy className="size-3.5 text-pick" />
        <Flag
          code={champ?.code}
          size="var(--cf)"
          className="block rounded-full"
        />
      </div>
      <span className="rounded-full bg-card px-1.5 text-[10px] font-semibold tabular-nums text-foreground/80">
        {p === undefined ? "··" : `${Math.round(p * 100)}%`}
      </span>
    </div>
  );
}

const HELP_TEXT =
  "The bracket from the outside in: each pair of flags meets and the favourite advances one ring toward the centre. The number by a flag is that team's chance to win its match; the centre shows the title odds, and the highlighted line is the predicted champion's road to it.";

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

/** The knockout bracket as a circle: the structure renders immediately, picks
 *  and the champion's path fill in once the market loads. */
export function CircularBracketCard({ view }: { view?: CircularBracketView }) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center gap-1.5 border-b border-surface-divider px-3">
        <span className="shrink-0 text-[11px] font-medium tracking-wide text-foreground/70">
          Prediction bracket
        </span>
        <span className="min-w-0 truncate text-[10px] text-muted-foreground/55">
          · each team's chance to advance
        </span>
        <CircularBracketHelp />
      </div>
      <div className="px-3 py-4">
        <div className="relative mx-auto aspect-square w-full max-w-[820px] [--cf:20px] sm:[--cf:26px] lg:[--cf:30px]">
          <Connectors view={view} />
          {GEOMETRY.flags.map((pos) => (
            <FlagNode key={`${pos.match}:${pos.side}`} pos={pos} view={view} />
          ))}
          <ChampionChip view={view} />
        </div>
      </div>
    </div>
  );
}

"use client";

import { cn } from "cnfast";
import { addMinutes, format } from "date-fns";
import { Info, Trophy } from "lucide-react";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  type RefCallback,
  useCallback,
  useContext,
  useState,
} from "react";

import {
  PopupHeader,
  type TeamJourney,
  TeamPopup,
} from "@/components/widgets/cell-path-explain";
import { Flag } from "@/components/flags";
import { Card } from "@/components/ui/card";
import { Popover } from "@/components/ui/popover";
import {
  type Cursor,
  type ProximityField,
  type ProximityNode,
  useProximityField,
} from "@/hooks/use-proximity-field";
import type { CellPath } from "@/lib/predictions/team-path";
import { type KnockoutMatch, matchByNumber } from "@/lib/tournament";

// The knockout bracket as a ring, in the spirit of the source artwork: the 32
// Round-of-32 teams around the outside, connectors merging inward to the trophy
// at the centre. Every node shows a flag once its team is locked in; until then
// it's a chevron that opens its chances. Geometry is computed once in a
// 1000×1000 space (the SVG viewBox); flags/buttons overlay as HTML positioned by
// percentage, so the whole thing scales with the square container.

const SIZE = 1000;
const C = SIZE / 2;

// Each half spans 180°−2·GAP, leaving a GAP wedge at top and bottom so the two
// halves read apart and the finalists meet on the horizontal centre axis.
const GAP = 0;
const R_FLAG = 450; // outer ring: the 32 team slots
type RoundKey = "R32" | "R16" | "QF" | "SF";
// ── Ring spacing ──────────────────────────────────────────────────────────
// The radial gap between each ring, working inward from the outer flags. Tune
// these to space the rings apart; every ring radius below is derived from them,
// so this is the single place to adjust the layout's concentric spacing.
const RING_GAP = {
  flagToR32: 125, // outer flags (32) → round-of-16 nodes
  r32ToR16: 80, // round-of-16 nodes → round-of-8 nodes
  r16ToQF: 75, // quarter-final nodes
  qfToSF: 60, // semi-final nodes
};
// Derived ring radii (distance from centre), outside → in.
const RING: Record<RoundKey, number> = {
  R32: R_FLAG - RING_GAP.flagToR32,
  R16: R_FLAG - RING_GAP.flagToR32 - RING_GAP.r32ToR16,
  QF: R_FLAG - RING_GAP.flagToR32 - RING_GAP.r32ToR16 - RING_GAP.r16ToQF,
  SF:
    R_FLAG -
    RING_GAP.flagToR32 -
    RING_GAP.r32ToR16 -
    RING_GAP.r16ToQF -
    RING_GAP.qfToSF,
};
// The round a match's winner advances to — what its contenders are racing to reach.
const NEXT_LABEL: Record<RoundKey, string> = {
  R32: "round of 16",
  R16: "quarter-final",
  QF: "semi-final",
  SF: "final",
};
// Display name of a match's own round, for the popover sub-header.
const ROUND_NAME: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  TP: "Third place",
  FINAL: "Final",
};

// "2026-07-01T19:00:00Z" → "Jul 1". Date only (no time) to avoid timezone
// confusion; the UTC shift keeps the calendar day stable across timezones.
function matchDateLabel(kickoffAt: string): string {
  const date = new Date(kickoffAt);
  const utc = addMinutes(date, date.getTimezoneOffset());
  return format(utc, "MMM d");
}
const CHILD_ROUND: Record<Exclude<RoundKey, "R32">, RoundKey> = {
  R16: "R32",
  QF: "R16",
  SF: "QF",
};

const LEFT = { root: 101, start: 180 + GAP, end: 360 - GAP };
const RIGHT = { root: 102, start: GAP, end: 180 - GAP };

// A team this likely is treated as locked in — shown as a flag, not a chevron.
const CONFIRMED = 0.99;

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

/** Stagger (seconds) for a node's reveal so predictions ripple inward from the
 *  edge: the outer flags appear first, nodes nearer the centre last. */
function rippleDelay(x: number, y: number): number {
  const r = Math.hypot(x - C, y - C);
  return round2((1 - r / R_FLAG) * 0.5);
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

// When a connector is drawn solid. A leg is solid only once a team has actually
// advanced along it (the match at its outer end is played), so the solid lines
// trace the real winners' paths rather than the merely-qualified field.
type SolidWhen =
  // A R32 spoke: a flag → R32 node. Solid once that R32 match is played and this
  // side's team won it.
  | { kind: "r32leg"; match: number; side: Side }
  // An inner spoke: child node → parent node. Solid once the parent match is
  // played and its winner is the team that came up through `child`.
  | { kind: "innerleg"; parent: number; child: number }
  // A final spoke: semi-final node → champion. Solid once the final is played
  // and its winner is the team that came up through this semi-final.
  | { kind: "finalleg"; sf: number }
  // The trunk from a node out to its sibling-merge point. Solid once that match
  // is decided (a winner has arrived at the node).
  | { kind: "trunk"; match: number }
  // Arcs (the bars joining siblings) are never drawn solid.
  | { kind: "never" };

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  solid: SolidWhen;
}
interface Arc {
  d: string;
  solid: SolidWhen;
}
interface FlagPos {
  match: number;
  side: Side;
  x: number;
  y: number;
}
interface InnerNode {
  match: number;
  round: RoundKey;
  x: number;
  y: number;
}
interface Geometry {
  flags: FlagPos[];
  nodes: InnerNode[];
  segs: Seg[];
  arcs: Arc[];
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

/** Build the skeleton: the outer flags, the inner match nodes, and the
 *  connectors between them. Computed once at module load. */
function buildGeometry(): Geometry {
  const flags: FlagPos[] = [];
  const nodes: InnerNode[] = [];
  const segs: Seg[] = [];
  const arcs: Arc[] = [];
  const sfAngle = new Map<number, number>();

  for (const { root, start, end } of [LEFT, RIGHT]) {
    const { leaves, flagAngle, nodeAngle } = halfAngles(root, start, end);

    for (const lf of leaves) {
      const a = flagAngle.get(`${lf.match}:${lf.side}`)!;
      flags.push({ ...lf, ...polar(a, R_FLAG) });
    }

    for (const [num, ang] of nodeAngle) {
      const m = matchByNumber[num];
      const round = m.round as RoundKey;
      const rN = RING[round];
      nodes.push({ match: num, round, ...polar(ang, rN) });
      if (num === root) sfAngle.set(num, ang);

      const kids = childMatches(m);
      if (!kids) {
        // R32 → flags: the two feeding paths merge at a midpoint radius between
        // this node's ring and the flag ring — a short radial trunk runs out to
        // that midpoint, an arc there spreads to each flag's angle, and a short
        // radial spoke then enters each flag head-on (from the front).
        const rMid = (rN + R_FLAG) / 2;
        const trunk = polar(ang, rMid);
        const base = polar(ang, rN);
        segs.push({
          x1: base.x,
          y1: base.y,
          x2: trunk.x,
          y2: trunk.y,
          solid: { kind: "trunk", match: num },
        });
        for (const side of ["home", "away"] as Side[]) {
          const fa = flagAngle.get(`${num}:${side}`)!;
          const leg: SolidWhen = { kind: "r32leg", match: num, side };
          arcs.push({ d: arcPath(rMid, fa, ang), solid: leg });
          const mid = polar(fa, rMid);
          const tip = polar(fa, R_FLAG);
          segs.push({
            x1: mid.x,
            y1: mid.y,
            x2: tip.x,
            y2: tip.y,
            solid: leg,
          });
        }
      } else {
        // Inner nodes keep the original side-entry style: a spoke from each child
        // out to the parent's ring, and an arc at the parent radius that bends
        // into the node from the side.
        const rChild = RING[CHILD_ROUND[round as Exclude<RoundKey, "R32">]];
        for (const cm of kids) {
          const ca = nodeAngle.get(cm)!;
          const inner = polar(ca, rN);
          const outer = polar(ca, rChild);
          const leg: SolidWhen = { kind: "innerleg", parent: num, child: cm };
          segs.push({
            x1: inner.x,
            y1: inner.y,
            x2: outer.x,
            y2: outer.y,
            solid: leg,
          });
          arcs.push({ d: arcPath(rN, ca, ang), solid: leg });
        }
      }
    }
  }

  // The final: each semi runs straight to the centre, where the champion sits.
  // Solid once the final is played and its winner came up through this semi.
  for (const sf of [LEFT.root, RIGHT.root]) {
    const p = polar(sfAngle.get(sf)!, RING.SF);
    segs.push({
      x1: C,
      y1: C,
      x2: p.x,
      y2: p.y,
      solid: { kind: "finalleg", sf },
    });
  }

  return { flags, nodes, segs, arcs };
}

const GEOMETRY = buildGeometry();

export interface Candidate {
  code: string;
  name?: string;
  probability: number;
  /** The same team's chance at the start of the day, when known. The bar paints
   *  the shared value in the base colour and the move since in green/red. Absent
   *  for settled/unsnapshotted nodes — the bar is then solid. */
  baseline?: number;
}

/** Everything the card paints onto the skeleton: the candidates for each R32
 *  slot, the teams that could reach each match, the real winner of any finished
 *  match, and the title odds. */
export interface CircularBracketView {
  slotOdds: Map<string, Candidate[]>; // "match:side" → R32 occupant candidates
  matchOdds: Map<number, Candidate[]>; // match → each contender's chance to win
  decided: Map<number, Candidate>; // match → real winner, once played
  live: Set<number>; // match numbers currently in progress
  liveLeader: Map<number, string>; // live match → team code currently ahead
  championOdds: Candidate[];
}

/** Road-to-the-final breakdown per team code, for the locked-in teams that still
 *  have a route. A team's flag is tappable only when it has an entry here. */
export type TeamPaths = Map<string, CellPath>;

/** A team's actual World Cup run so far, per team code — shown for every
 *  locked-in flag (winners and losers), so all of them are tappable. */
export type TeamJourneys = Map<string, TeamJourney>;

const pct = (v: number) => `${(v / SIZE) * 100}%`;
const formatPct = (p: number) => `${(p * 100).toPrecision(4)}%`;
const lead = (odds?: Candidate[]) => odds?.[0];
const confirmed = (odds?: Candidate[]) =>
  (lead(odds)?.probability ?? 0) >= CONFIRMED;

/** A flag cropped to a circle (the app's flag sprite is 4:3) — closer to the
 *  source artwork and cleaner at the sizes this widget uses. `size` is any CSS
 *  length, so callers can pass a container-relative unit and let it scale. */
function RoundFlag({
  code,
  size,
  className,
  faded,
}: {
  code?: string;
  size: string;
  className?: string;
  /** Render the flag image semi-transparent over its solid base (used for
   *  unconfirmed/predicted nodes). The base stays opaque so it still covers the
   *  connector lines behind it. */
  faded?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full bg-surface-2 ring-1 ring-surface-border",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Flag
        code={code}
        size={`calc(${size} * 4 / 3)`}
        className={cn(
          "absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 rounded-none ring-0",
          faded && "opacity-40",
        )}
      />
    </span>
  );
}

function Connectors({ view }: { view?: CircularBracketView }) {
  // Solid only traces the path a winner actually travelled: the leg's outer
  // match must be played AND the team that advanced inward must be the one on
  // this leg. So a freshly-qualified (but not-yet-played) team's spoke stays
  // dashed — it only turns solid once it wins and moves on.
  const isSolid = (s: SolidWhen): boolean => {
    switch (s.kind) {
      case "never":
        return false;
      case "r32leg": {
        const win = view?.decided.get(s.match);
        const team = lead(view?.slotOdds.get(`${s.match}:${s.side}`));
        return !!win && !!team && win.code === team.code;
      }
      case "innerleg": {
        const win = view?.decided.get(s.parent);
        const child = view?.decided.get(s.child);
        return !!win && !!child && win.code === child.code;
      }
      case "finalleg": {
        const win = view?.decided.get(104);
        const finalist = view?.decided.get(s.sf);
        return !!win && !!finalist && win.code === finalist.code;
      }
      case "trunk":
        // The trunk lights once a winner has arrived at the node.
        return !!view?.decided.get(s.match);
    }
  };

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative connectors; structure is conveyed by the labelled nodes it links.
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      {GEOMETRY.arcs.map((a) => {
        const solid = isSolid(a.solid);
        return (
          <path
            key={a.d}
            d={a.d}
            fill="none"
            // Winner's path in the trophy's green; everything else stays grey.
            stroke={solid ? "var(--pick)" : "var(--border-strong)"}
            strokeWidth={2.5}
          />
        );
      })}
      {GEOMETRY.segs.map((s, i) => {
        const solid = isSolid(s.solid);
        return (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is static
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            // Winner's path in the trophy's green; everything else stays grey.
            stroke={solid ? "var(--pick)" : "var(--border-strong)"}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** A single team's chance, as a flag + code + bar + percentage — the row style
 *  used across the prediction widgets. Rows fade in and their bars sweep out
 *  from the left when the popover opens. */
function OddsRow({ c, top }: { c: Candidate; top: boolean }) {
  // The white bar always spans the initial value. A rise shows as green added
  // to its right (bar reaches `now`); a fall as red laid over its right edge
  // (the lost slice between `now` and `start`).
  // With no baseline, start equals now, so there's no move and the bar stays solid.
  const now = c.probability;
  const start = c.baseline ?? now;
  const delta = now - start;
  const rose = delta > 0;
  const moved = Math.abs(delta) > 0.01; // worth showing (>1pt)
  const pctLabel = moved
    ? `${formatPct(start)} -> ${formatPct(now)}`
    : formatPct(now);
  const barTitle = moved
    ? `now ${formatPct(now)} · start ${formatPct(start)}`
    : undefined;
  return (
    <div className="animate-fade-in flex h-5 items-center gap-1.5">
      <RoundFlag code={c.code} size="14px" />
      <span
        title={c.name}
        className={cn(
          "w-7 shrink-0 text-xs font-semibold tracking-wide",
          top ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {c.code}
      </span>
      <span
        title={barTitle}
        className="flex h-2 flex-1 overflow-hidden rounded-[1px] bg-muted/50"
      >
        {/* Everything grows together as one stack, so no gap opens mid-animation. */}
        <span className="animate-bar-grow relative flex h-full w-full origin-left">
          <span
            className="h-full bg-foreground"
            style={{ width: formatPct(start) }}
          />
          {moved && rose && (
            <span style={{ width: formatPct(delta) }}>
              {/* Skeleton-style pulse so the live move reads as in-play. */}
              <span className="block h-full w-full animate-pulse bg-emerald-400" />
            </span>
          )}
          {moved && !rose && (
            <span
              className="absolute inset-y-0 animate-pulse bg-red-400"
              style={{ left: formatPct(now), width: formatPct(-delta) }}
            />
          )}
        </span>
      </span>
      <span
        className={cn(
          "min-w-8 whitespace-nowrap pr-0.5 text-right text-xs tabular-nums",
          top ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {pctLabel}
      </span>
    </div>
  );
}

function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 animate-pulse rounded-full bg-rose-400",
        className,
      )}
    />
  );
}

function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs font-semibold tracking-wide text-rose-400",
        className,
      )}
    >
      <LiveDot className="size-1.5" />
      Live
    </span>
  );
}

/** The body of a chances popover: which match it is, then a titled ranked list. */
function OddsList({
  title,
  subtitle,
  odds,
  live,
}: {
  title: string;
  subtitle?: string;
  odds: Candidate[];
  /** Mark the popup as live (the underlying match is in progress). */
  live?: boolean;
}) {
  const shown = odds.filter((c) => c.probability >= 0.01).slice(0, 8);
  return (
    <div className="relative">
      {live && <LiveBadge className="absolute top-0 right-0" />}
      <PopupHeader title={title} subtitle={subtitle} />
      <div className="space-y-1">
        {shown.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic">no market</p>
        ) : (
          shown.map((c, i) => <OddsRow key={c.code} c={c} top={i === 0} />)
        )}
      </div>
    </div>
  );
}

interface NodeProps {
  openId: string | null;
  onToggle: (id: string, anchor: HTMLElement) => void;
}

/** Wraps a node so it plays the outward "ripple" reveal once on mount. The
 *  animation lives on this inner element (not the positioning wrapper) so it
 *  never clashes with the wrapper's centring transform. */
function NodeReveal({
  delay,
  children,
}: {
  delay: number;
  children: ReactNode;
}) {
  return (
    <div className="animate-predict-in" style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

/** A node whose team isn't settled yet. It always contains both layers — the
 *  "?" placeholder and the predicted front-runner's faded flag — stacked on top
 *  of each other, and cross-fades between them when `predict` toggles, so the
 *  two states morph into one another rather than popping in and out. */
function UnsettledNode({
  id,
  code,
  size = "var(--cf)",
  predict,
  live,
  openId,
  onToggle,
}: NodeProps & {
  id: string;
  /** Front-runner's flag code, when a market exists for this node. */
  code?: string;
  size?: string;
  predict?: boolean;
  /** The node's match is in progress: the leader's flag shows extra-faded so it
   *  never reads as a confirmed result. */
  live?: boolean;
}) {
  const open = openId === id;
  const showFlag = !!(predict && code);
  return (
    <button
      type="button"
      onClick={(e) => onToggle(id, e.currentTarget)}
      aria-label="Show chances"
      aria-expanded={open}
      className="group relative block rounded-full"
      style={{ width: `calc(${size})`, height: `calc(${size})` }}
    >
      {/* "?" layer — stays fully opaque underneath so the crossfade never
          exposes the card behind it; the flag (with its own solid base) simply
          fades in on top, giving a clean A→B transition. */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-surface-2 font-semibold transition-colors duration-300 ease-out",
          open
            ? "border-foreground/65 text-foreground"
            : "border-surface-border text-muted-foreground group-hover:text-foreground",
        )}
        style={{
          width: `calc(${size} * 0.82)`,
          height: `calc(${size} * 0.82)`,
          fontSize: `calc(${size} * 0.42)`,
        }}
      >
        {/* Hidden under a live leader's flag so the "?" doesn't show through. */}
        {live && showFlag ? "" : "?"}
      </span>
      {/* Predicted-flag layer — fades in over the solid base, which keeps the
          connector lines covered and hides the "?" beneath. */}
      {code && (
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 ease-out",
            showFlag ? (live ? "opacity-30" : "opacity-100") : "opacity-0",
          )}
        >
          <RoundFlag
            code={code}
            size={`calc(${size} * 0.82)`}
            faded
            className={cn(
              "transition-[filter] group-hover:brightness-110",
              open ? "ring-foreground/65" : "ring-surface-divider",
            )}
          />
        </span>
      )}
    </button>
  );
}

/** A locked-in team's flag. Plain when there's no path to explain; otherwise a
 *  button that opens the team's road to the final. Its selected and hover
 *  treatment matches the unsettled nodes so the ring never reads as a different
 *  kind of state — neutral, never the winner's green. */
function FlagNode({
  id,
  code,
  size,
  explainable,
  openId,
  onToggle,
}: NodeProps & {
  id: string;
  code: string;
  size: string;
  explainable: boolean;
}) {
  if (!explainable)
    return (
      <RoundFlag code={code} size={size} className="ring-surface-divider" />
    );
  const open = openId === id;
  return (
    <button
      type="button"
      onClick={(e) => onToggle(id, e.currentTarget)}
      aria-label={`Show ${code} road to the final`}
      aria-expanded={open}
      className="group block rounded-full"
    >
      <RoundFlag
        code={code}
        size={size}
        className={cn(
          "transition-[filter] group-hover:brightness-110",
          open ? "ring-foreground/65" : "ring-surface-divider",
        )}
      />
    </button>
  );
}

/** A node still waiting on its data: a plain pulsing circle, kept distinct from
 *  the "?" so loading never reads as an undecided match. Sits under the real node
 *  and fades out as it arrives, so it pulses only while `pulse` is set. */
function NodeSkeleton({
  size,
  pulse = true,
  className,
  style,
}: {
  size: string;
  pulse?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        "block rounded-full bg-surface-2 ring-1 ring-surface-border",
        pulse && "animate-pulse",
        className,
      )}
      style={{ width: `calc(${size})`, height: `calc(${size})`, ...style }}
    />
  );
}

// Every outer/inner node is the same size; only the centre champion differs.
const NODE_SIZE = "calc(var(--cf) * 0.85)";
const NODE_FACTOR = 0.85; // node size as a fraction of --cf (matches NODE_SIZE)

// ── Cursor-proximity "magnetism" ───────────────────────────────────────────
// Nodes grow a touch as the cursor nears their centre. The growth is capped at
// MAX_GROW px and falls off with a Gaussian in the 1000×1000 viewBox space, so a
// node swells only when the cursor is genuinely close and the effect tapers off
// smoothly to its neighbours.
const MAX_GROW = 8; // px a node gains at the cursor's exact centre
const PROXIMITY_SIGMA = 120; // Gaussian falloff radius, in viewBox units

// A node's base size as a fraction of --cf, so the field can size its +MAX_GROW
// growth exactly (a flag fills the node, an unsettled "?" is smaller).
interface NodeMeta {
  factor: number;
}

const ProximityContext = createContext<ProximityField<NodeMeta> | null>(null);

/** The current --cf value (px) derived from the container width, matching the
 *  `clamp(20px, 7.2cqw, 44px)` set in CSS — lets us size the +MAX_GROW growth
 *  exactly without reading each node's box. */
function cfPx(width: number): number {
  return Math.max(20, Math.min((7.2 * width) / 100, 44));
}

/** Per-frame effect for the ring: scale a node up by up to MAX_GROW px, falling
 *  off with a Gaussian in the 1000×1000 viewBox space as the cursor recedes from
 *  its centre. A null cursor (pointer gone) resets it to its base size. */
function scaleByProximity(
  node: ProximityNode<NodeMeta>,
  cursor: Cursor | null,
  rect: DOMRect,
): void {
  if (!cursor) {
    node.el.style.transform = "scale(1)";
    return;
  }
  const px = (cursor.x / rect.width) * SIZE;
  const py = (cursor.y / rect.height) * SIZE;
  const d = Math.hypot(px - node.x, py - node.y);
  const f = Math.exp(-(d * d) / (2 * PROXIMITY_SIGMA * PROXIMITY_SIGMA));
  const base = cfPx(rect.width) * node.meta.factor;
  const scale = f > 0.01 ? (base + MAX_GROW * f) / base : 1;
  node.el.style.transform = `scale(${round2(scale)})`;
}

/** Registers a node's positioned wrapper with the proximity field and returns a
 *  ref callback for it, so the field can scale it as the cursor approaches. */
function useProximityRef(
  id: string,
  x: number,
  y: number,
  factor: number,
): RefCallback<HTMLDivElement> {
  const field = useContext(ProximityContext);
  return useCallback(
    (el: HTMLDivElement | null) => {
      if (!field) return;
      if (el) field.register(id, { x, y, meta: { factor }, el });
      else field.unregister(id);
    },
    [field, id, x, y, factor],
  );
}

/** What a node should paint, read off the view. `flagCode` means the team is
 *  locked in; otherwise `predictedCode` feeds the unsettled overlay. */
interface NodeModel {
  id: string;
  x: number;
  y: number;
  flagCode?: string;
  predictedCode?: string;
  explainable: boolean; // the locked-in flag opens a road-to-the-final breakdown
  live: boolean; // the node's match is in progress
  liveLeaderCode?: string; // team currently ahead, while the match is live
}

// A locked-in flag is tappable when we have something to show for it: a road to
// the final (still alive) or a played-so-far run (any team that has kicked off).
function explainable(
  code: string | undefined,
  teamPaths?: TeamPaths,
  teamJourneys?: TeamJourneys,
): boolean {
  return !!code && (!!teamPaths?.has(code) || !!teamJourneys?.has(code));
}

function slotModel(
  pos: FlagPos,
  view: CircularBracketView | undefined,
  teamPaths?: TeamPaths,
  teamJourneys?: TeamJourneys,
): NodeModel {
  const odds = view?.slotOdds.get(`${pos.match}:${pos.side}`);
  const top = lead(odds);
  const flagCode = confirmed(odds) ? top?.code : undefined;
  return {
    id: `slot:${pos.match}:${pos.side}`,
    x: pos.x,
    y: pos.y,
    flagCode,
    predictedCode: top?.code,
    explainable: explainable(flagCode, teamPaths, teamJourneys),
    live: view?.live.has(pos.match) ?? false,
    liveLeaderCode: view?.liveLeader.get(pos.match),
  };
}

function matchModel(
  node: InnerNode,
  view: CircularBracketView | undefined,
  teamPaths?: TeamPaths,
  teamJourneys?: TeamJourneys,
): NodeModel {
  const flagCode = view?.decided.get(node.match)?.code;
  const top = lead(view?.matchOdds.get(node.match));
  return {
    id: `match:${node.match}`,
    x: node.x,
    y: node.y,
    flagCode,
    predictedCode: top?.code,
    explainable: explainable(flagCode, teamPaths, teamJourneys),
    live: view?.live.has(node.match) ?? false,
    liveLeaderCode: view?.liveLeader.get(node.match),
  };
}

/** One bracket node: a skeleton while its data loads, a locked-in flag once the
 *  team is known, or a tappable "?" onto the chances in between. The node ripples
 *  in once on mount with the skeleton already in place; when data arrives the
 *  skeleton fades out as the real node fades in over the same spot, so there's no
 *  disappear-and-regrow flash between the two states. */
function BracketNode({
  model,
  loading,
  predict,
  openId,
  onToggle,
}: NodeProps & { model: NodeModel; loading: boolean; predict?: boolean }) {
  // Reuse the mount ripple's outside→inside timing so the nodes wave in from the
  // edge when the data arrives, rather than all settling from skeleton at once.
  const wave = rippleDelay(model.x, model.y);
  // The skeleton never fades to empty: it stays opaque and shrinks to the loaded
  // node's base size as the (opaque-based) content fades in on top, so it ends up
  // fully covered. A flag fills the whole node; an unsettled "?" is smaller.
  const settleScale = loading || model.flagCode ? 1 : 0.82;
  const proximityRef = useProximityRef(model.id, model.x, model.y, NODE_FACTOR);
  return (
    <div
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: pct(model.x), top: pct(model.y) }}
    >
      <NodeReveal delay={wave}>
        <div
          ref={proximityRef}
          className="relative grid place-items-center transition-transform duration-150 ease-out [will-change:transform]"
          style={{ width: `calc(${NODE_SIZE})`, height: `calc(${NODE_SIZE})` }}
        >
          <NodeSkeleton
            size={NODE_SIZE}
            pulse={loading}
            className="col-start-1 row-start-1 transition-transform duration-300 ease-out"
            style={{
              transform: `scale(${settleScale})`,
              transitionDelay: loading ? undefined : `${wave}s`,
            }}
          />
          {/* The node's own edge, recoloured and breathing, marks a live match.
              Scaled to the node so the ring sits flush against it. */}
          {model.live && (
            <span
              aria-hidden
              style={{ transform: `scale(${settleScale})` }}
              className="pointer-events-none absolute inset-0 animate-pulse rounded-full ring-2 ring-rose-400/55"
            />
          )}
          {!loading && (
            <div
              className="col-start-1 row-start-1 animate-fade-in"
              style={{ animationDelay: `${wave}s` }}
            >
              {model.flagCode ? (
                <FlagNode
                  id={model.id}
                  code={model.flagCode}
                  size={NODE_SIZE}
                  explainable={model.explainable}
                  openId={openId}
                  onToggle={onToggle}
                />
              ) : (
                <UnsettledNode
                  id={model.id}
                  code={model.liveLeaderCode ?? model.predictedCode}
                  size={NODE_SIZE}
                  predict={predict || !!model.liveLeaderCode}
                  live={model.live}
                  openId={openId}
                  onToggle={onToggle}
                />
              )}
            </div>
          )}
        </div>
      </NodeReveal>
    </div>
  );
}

/** The centre: a same-size circle holding the trophy (or the champion's flag
 *  once the final is played), opening the title odds on tap. */
function ChampionNode({
  view,
  openId,
  onToggle,
}: NodeProps & { view?: CircularBracketView }) {
  const win = view?.decided.get(104);
  const isOpen = openId === "champion";
  const proximityRef = useProximityRef("champion", C, C, 1);
  return (
    <div
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: "50%", top: "50%" }}
    >
      <NodeReveal delay={0}>
        <div
          ref={proximityRef}
          className="transition-transform duration-150 ease-out [will-change:transform]"
        >
          {win ? (
            <button
              type="button"
              onClick={(e) => onToggle("champion", e.currentTarget)}
              aria-label="Show title odds"
              className="block rounded-full ring-2 ring-pick"
            >
              <RoundFlag code={win.code} size="var(--cf)" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => onToggle("champion", e.currentTarget)}
              aria-label="Show title odds"
              aria-expanded={isOpen}
              className={cn(
                "flex size-[var(--cf)] items-center justify-center rounded-full border bg-card transition-colors",
                isOpen
                  ? "border-pick text-pick"
                  : "border-pick/50 text-pick/80",
              )}
            >
              <Trophy style={{ width: "55%", height: "55%" }} />
            </button>
          )}
        </div>
      </NodeReveal>
    </div>
  );
}

/** Which match a node belongs to and when it kicks off. */
function matchSubtitle(num: number): string {
  const m = matchByNumber[num];
  return `${ROUND_NAME[m.round]} · #${num} · ${matchDateLabel(m.kickoffAt)}`;
}

/** The header, sub-header and team list for the currently open node. */
function openContent(
  view: CircularBracketView,
  id: string,
): {
  title: string;
  subtitle: string;
  odds: Candidate[];
  live: boolean;
} | null {
  if (id === "champion")
    return {
      title: "Chances to win the title",
      subtitle: matchSubtitle(104),
      odds: view.championOdds,
      live: view.live.has(104),
    };
  if (id.startsWith("slot:")) {
    const sideKey = id.slice("slot:".length);
    const odds = view.slotOdds.get(sideKey);
    if (!odds) return null;
    const num = Number(sideKey.split(":")[0]);
    return {
      title: "Chances to reach this match",
      subtitle: matchSubtitle(num),
      odds,
      live: view.live.has(num),
    };
  }
  const num = Number(id.slice("match:".length));
  const odds = view.matchOdds.get(num);
  if (!odds) return null;
  const round = matchByNumber[num].round as RoundKey;
  return {
    title: `Chances to reach the ${NEXT_LABEL[round]}`,
    subtitle: matchSubtitle(num),
    odds,
    live: view.live.has(num),
  };
}

/** The locked-in team behind an open node, if any: a confirmed R32 slot's
 *  occupant or a played match's winner. Such a node opens its road to the final
 *  instead of the chances list. */
function confirmedTeamCode(
  view: CircularBracketView,
  id: string,
): string | undefined {
  if (id.startsWith("slot:")) {
    const odds = view.slotOdds.get(id.slice("slot:".length));
    return confirmed(odds) ? lead(odds)?.code : undefined;
  }
  if (id.startsWith("match:"))
    return view.decided.get(Number(id.slice("match:".length)))?.code;
  return undefined;
}

const HELP_TEXT =
  "Tap an open node to see each team's chance of reaching that match, or a locked-in flag to see its road to the final. The chances are computed from the betting market and refresh every minute.";

/** Header info affordance — a popover on tap (native `title` is hover-only). */
function CircularBracketHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
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
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          {/* Above the bracket nodes (z-30), which the card isolates. */}
          <div className="absolute top-full right-0 z-50 mt-1.5 w-64 rounded-md border border-surface-border bg-surface-2 p-2 text-xs leading-relaxed text-muted-foreground shadow-lg">
            {HELP_TEXT}
          </div>
        </>
      )}
    </div>
  );
}

/** Compact header switch to turn the predicted-flags overlay on or off. */
export function PredictToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Show market predictions"
      onClick={() => onChange(!on)}
      className="flex cursor-pointer items-center gap-1.5"
    >
      <span className="text-xs font-medium text-muted-foreground/70">
        Show market predictions
      </span>
      <span
        className={cn(
          "relative flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-pick" : "bg-surface-border",
        )}
      >
        <span
          className={cn(
            "absolute size-2.5 rounded-full bg-card transition-transform",
            on ? "translate-x-3" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** The interactive ring on its own — connectors, nodes, the centre champion and
 *  the popover each opens on tap. Sizing is container-relative (cqw) so it fills
 *  whatever width its parent gives it; pass `className` to cap or pad it. Used
 *  bare on the home and wrapped in a card on the predictions page. */
export function CircularBracketRing({
  view,
  teamPaths,
  teamJourneys,
  predict = false,
  className,
}: {
  view?: CircularBracketView;
  /** Road to the final per locked-in team, making those flags tappable. */
  teamPaths?: TeamPaths;
  /** Actual run so far per locked-in team, so every flag (including knocked-out
   *  ones) is tappable and its popover opens with what already happened. */
  teamJourneys?: TeamJourneys;
  /** Show the leading candidate's flag (faded) in unsettled nodes instead of "?". */
  predict?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement } | null>(
    null,
  );
  const onToggle = (id: string, anchor: HTMLElement) =>
    setOpen((cur) => (cur?.id === id ? null : { id, anchor }));
  const openId = open?.id ?? null;
  const loading = !view;

  // A locked-in flag opens its team popover (run so far + road to the final);
  // any other node opens the node's chances.
  const teamCode = open && view ? confirmedTeamCode(view, open.id) : undefined;
  const teamPath = teamCode ? teamPaths?.get(teamCode) : undefined;
  const teamJourney = teamCode ? teamJourneys?.get(teamCode) : undefined;
  const isTeam = Boolean(teamPath || teamJourney);
  const content = open && view && !isTeam ? openContent(view, open.id) : null;

  const { containerRef, field, onPointerMove, onPointerLeave } =
    useProximityField<NodeMeta>(scaleByProximity);

  return (
    <>
      {/* Sizes are container-relative (cqw), so the whole ring fits any width
          without scrolling and the flags scale up with it. */}
      <div
        ref={containerRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className={cn(
          "relative mx-auto aspect-square w-full [--cf:clamp(20px,7.2cqw,44px)] [container-type:inline-size]",
          className,
        )}
      >
        <ProximityContext.Provider value={field}>
          <Connectors view={view} />
          {GEOMETRY.nodes.map((node) => (
            <BracketNode
              key={`match:${node.match}`}
              model={matchModel(node, view, teamPaths, teamJourneys)}
              loading={loading}
              predict={predict}
              openId={openId}
              onToggle={onToggle}
            />
          ))}
          {GEOMETRY.flags.map((pos) => (
            <BracketNode
              key={`slot:${pos.match}:${pos.side}`}
              model={slotModel(pos, view, teamPaths, teamJourneys)}
              loading={loading}
              predict={predict}
              openId={openId}
              onToggle={onToggle}
            />
          ))}
          <ChampionNode view={view} openId={openId} onToggle={onToggle} />
        </ProximityContext.Provider>
      </div>
      <Popover
        open={Boolean(open && (isTeam || content))}
        anchor={open?.anchor ?? null}
        onClose={() => setOpen(null)}
        className="w-[min(20rem,calc(100vw-1rem))] p-2.5"
      >
        {isTeam ? (
          <TeamPopup journey={teamJourney} path={teamPath} />
        ) : (
          content && (
            <OddsList
              title={content.title}
              subtitle={content.subtitle}
              odds={content.odds}
              live={content.live}
            />
          )
        )}
      </Popover>
    </>
  );
}

/** The knockout bracket as a ring of flags and chevrons. Structure renders
 *  immediately; flags lock in and chances open as the market resolves. */
export function CircularBracketCard({
  view,
  predict: predictDefault = false,
  teamPaths,
  teamJourneys,
}: {
  view?: CircularBracketView;
  /** Initial state of the predictions toggle: show the leading candidate's flag
   *  (faded) in unsettled nodes instead of a "?". Users can flip it in-card. */
  predict?: boolean;
  /** Road to the final per locked-in team, making those flags tappable. */
  teamPaths?: TeamPaths;
  /** Actual run so far per locked-in team, so knocked-out flags are tappable too. */
  teamJourneys?: TeamJourneys;
}) {
  const [predict, setPredict] = useState(predictDefault);
  return (
    // `isolate` keeps the nodes' z-index inside this card so they don't paint
    // over the page's sticky section header.
    <Card className="isolate">
      <div className="flex h-7 items-center gap-1.5 border-b border-surface-divider px-3">
        <span className="shrink-0 text-xs font-medium tracking-wide text-foreground/70">
          Prediction bracket
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground/55">
          · tap a node to see its chances
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CircularBracketHelp />
        </div>
      </div>
      <div className="px-2 py-4 sm:px-3">
        <div className="mb-2 flex justify-end px-1">
          <PredictToggle on={predict} onChange={setPredict} />
        </div>
        <CircularBracketRing
          view={view}
          teamPaths={teamPaths}
          teamJourneys={teamJourneys}
          predict={predict}
          className="max-w-[680px]"
        />
      </div>
    </Card>
  );
}

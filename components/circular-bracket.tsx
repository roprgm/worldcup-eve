"use client";

import { cn } from "cnfast";
import { Trophy } from "lucide-react";
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
import { Popover } from "@/components/ui/popover";
import {
  type Cursor,
  type ProximityField,
  useProximityField,
} from "@/hooks/use-proximity-field";
import type { CellPath } from "@/lib/predictions/team-path";
import { type KnockoutMatch, matchByNumber } from "@/lib/tournament";

// The knockout bracket as a ring, in the spirit of the source artwork: the 32
// Round-of-32 teams around the outside, connectors merging inward to the trophy
// at the centre. Geometry is computed once in a 1000×1000 space (the SVG
// viewBox); flags/buttons overlay as HTML positioned by percentage, so the
// whole thing scales with the square container.

// ── Public data model ────────────────────────────────────────────────────────

export type TeamCode = string; // 3-letter team code
export type Side = "home" | "away";
export type SlotKey = `${number}:${Side}`;
export const slotKey = (match: number, side: Side): SlotKey =>
  `${match}:${side}`;

export interface Candidate {
  code: TeamCode;
  name?: string;
  probability: number;
  /** The same team's chance at the start of the day, when known. The bar paints
   *  the shared value in the base colour and the move since in green/red. */
  baseline?: number;
}

/** What a match node paints while its result isn't in: ranked candidates (a "?"
 *  that opens the chances) or a single guessed winner (a full-opacity flag). */
export type Prediction = TeamCode | Candidate[];

/** A node on the ring: the 32 outer slots carry a side, every other node is
 *  just its match number (the centre is the final). */
export interface BracketNodeRef {
  match: number;
  side?: Side;
}

/** Road-to-the-final breakdown per team code. */
export type TeamPaths = Map<TeamCode, CellPath>;

/** A team's actual World Cup run so far, per team code — shown for every
 *  locked-in flag (winners and losers), so all of them are tappable. */
export type TeamJourneys = Map<TeamCode, TeamJourney>;

export interface CircularBracketProps {
  /** R32 occupants: slot → its locked-in team. An unfilled slot shows a "?". */
  slots?: Record<SlotKey, TeamCode>;
  /** Played matches: match → winner. Shown with the green ring, and the solid
   *  connectors trace these winners' paths inward. */
  results?: Record<number, TeamCode>;
  /** Undecided matches: match → candidates or a guessed winner. The final's
   *  entry (104) doubles as the centre node's title odds. */
  predictions?: Record<number, Prediction>;
  /** Match numbers currently in progress. */
  live?: Set<number>;
  /** Live match → team currently ahead, shown extra-faded in its node. */
  liveLeader?: Map<number, TeamCode>;
  /** Road to the final per team, making those flags tappable. */
  teamPaths?: TeamPaths;
  /** Actual run so far per team, so every flag (including knocked-out ones) is
   *  tappable and its popover opens with what already happened. */
  teamJourneys?: TeamJourneys;
  /** Show pulsing placeholders while the data is on its way. */
  isLoading?: boolean;
  /** Show each open node's leading candidate as a faded flag instead of "?". */
  predict?: boolean;
  /** A short note for a node — e.g. the reasoning behind a pick — shown in a
   *  popover when the node is tapped. Return undefined for nodes without one. */
  nodeNote?: (ref: BracketNodeRef) => string | undefined;
  /** Fires on every node tap, alongside the built-in popover. */
  onNodeSelect?: (node: BracketNodeRef) => void;
  className?: string;
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const SIZE = 1000;
const C = SIZE / 2;
const R_FLAG = 450; // outer ring: the 32 team slots

type RoundKey = "R32" | "R16" | "QF" | "SF";

// Each round's ring radius, outside → in (successive gaps of 125/80/75/60
// from the flag ring, tuned by eye).
const RING: Record<RoundKey, number> = {
  R32: R_FLAG - 125,
  R16: R_FLAG - 205,
  QF: R_FLAG - 280,
  SF: R_FLAG - 340,
};

// The two semi-finals root each half of the ring; their winners meet in the
// final (104) at the centre.
const LEFT = { root: 101, start: 180, end: 360 };
const RIGHT = { root: 102, start: 0, end: 180 };
const FINAL = 104;

// Round coordinates to a fixed precision: trig can differ in the last ULP
// between the server and browser JS engines, and the raw floats would otherwise
// hydrate with a mismatched `d`/position string.
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Point {
  x: number;
  y: number;
}

/** A point on the ring of radius `r` at `deg` clockwise from the top. */
function polar(deg: number, r: number): Point {
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

// When a connector is drawn solid — only once a team has actually travelled
// along it, so the solid lines trace the real winners' paths.
type SolidWhen =
  // A flag → R32-node leg: solid once that match is played and this side won it.
  | { kind: "slot"; match: number; side: Side }
  // A child-node → parent-node leg (the final's legs included): solid once the
  // parent is played and its winner is the team that came up through `child`.
  | { kind: "advance"; parent: number; child: number }
  // The trunk from a node out to its merge point: solid once a winner arrived.
  | { kind: "arrived"; match: number };

interface Seg {
  a: Point;
  b: Point;
  solid: SolidWhen;
}
interface Arc {
  d: string;
  solid: SolidWhen;
}
interface SlotPos {
  match: number;
  side: Side;
  x: number;
  y: number;
}
interface MatchPos {
  match: number;
  round: RoundKey;
  x: number;
  y: number;
}
interface Geometry {
  slots: SlotPos[];
  matches: MatchPos[];
  segs: Seg[];
  arcs: Arc[];
}

/** Build the skeleton: the outer flags, the inner match nodes, and the
 *  connectors between them. Computed once at module load. */
function buildGeometry(): Geometry {
  const slots: SlotPos[] = [];
  const matches: MatchPos[] = [];
  const segs: Seg[] = [];
  const arcs: Arc[] = [];

  // The bracket tree is perfectly balanced, so laying out a match at the centre
  // of its angular span — each feeder taking one half — spreads the leaves
  // evenly and centres every node between its children. Returns the angle.
  const layout = (n: number, start: number, end: number): number => {
    const m = matchByNumber[n];
    const round = m.round as RoundKey;
    const r = RING[round];
    const ang = (start + end) / 2;
    matches.push({ match: n, round, ...polar(ang, r) });

    const kids = childMatches(m);
    if (kids) {
      // A spoke from each child out to this ring, and an arc along this ring
      // that bends into the node from the side.
      const spans: [number, number, number][] = [
        [kids[0], start, ang],
        [kids[1], ang, end],
      ];
      for (const [child, s, e] of spans) {
        const ca = layout(child, s, e);
        const rChild = RING[matchByNumber[child].round as RoundKey];
        const leg: SolidWhen = { kind: "advance", parent: n, child };
        segs.push({ a: polar(ca, r), b: polar(ca, rChild), solid: leg });
        arcs.push({ d: arcPath(r, ca, ang), solid: leg });
      }
    } else {
      // R32 → flags: the two feeding paths merge at a midpoint radius between
      // this ring and the flag ring — a short radial trunk runs out to that
      // midpoint, an arc there spreads to each flag's angle, and a short radial
      // spoke then enters each flag head-on (from the front).
      const rMid = (r + R_FLAG) / 2;
      const trunk: SolidWhen = { kind: "arrived", match: n };
      segs.push({ a: polar(ang, r), b: polar(ang, rMid), solid: trunk });
      const sides: [Side, number][] = [
        ["home", (start + ang) / 2],
        ["away", (ang + end) / 2],
      ];
      for (const [side, fa] of sides) {
        slots.push({ match: n, side, ...polar(fa, R_FLAG) });
        const leg: SolidWhen = { kind: "slot", match: n, side };
        segs.push({ a: polar(fa, rMid), b: polar(fa, R_FLAG), solid: leg });
        arcs.push({ d: arcPath(rMid, fa, ang), solid: leg });
      }
    }
    return ang;
  };

  // Each half hangs off its semi-final, which runs straight to the centre,
  // where the champion sits.
  for (const { root, start, end } of [LEFT, RIGHT]) {
    const ang = layout(root, start, end);
    segs.push({
      a: { x: C, y: C },
      b: polar(ang, RING.SF),
      solid: { kind: "advance", parent: FINAL, child: root },
    });
  }

  return { slots, matches, segs, arcs };
}

const GEOMETRY = buildGeometry();

// ── Labels ───────────────────────────────────────────────────────────────────

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

// "2026-07-01T19:00:00Z" → "Jul 1". Date only (no time), pinned to UTC so the
// calendar day is stable across timezones.
const matchDateLabel = (kickoffAt: string) =>
  new Date(kickoffAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Which match a node belongs to, when it kicks off, and where it's played. */
function matchSubtitle(num: number): string {
  const m = matchByNumber[num];
  return `${ROUND_NAME[m.round]} · #${num} · ${matchDateLabel(m.kickoffAt)} · ${m.venue}`;
}

const pct = (v: number) => `${(v / SIZE) * 100}%`;
// Precise form drives the bar widths; the label rounds to whole points.
const formatPct = (p: number) => `${(p * 100).toPrecision(4)}%`;
const formatPctLabel = (p: number) => `${Math.round(p * 100)}%`;

// ── Building blocks ──────────────────────────────────────────────────────────

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

function Connectors({
  slots,
  results,
}: {
  slots?: Record<SlotKey, TeamCode>;
  results?: Record<number, TeamCode>;
}) {
  // Solid only traces the path a winner actually travelled: the leg's outer
  // match must be played AND the team that advanced inward must be the one on
  // this leg. So a freshly-qualified (but not-yet-played) team's spoke stays
  // dashed — it only turns solid once it wins and moves on.
  const isSolid = (s: SolidWhen): boolean => {
    switch (s.kind) {
      case "slot": {
        const win = results?.[s.match];
        return !!win && win === slots?.[slotKey(s.match, s.side)];
      }
      case "advance": {
        const win = results?.[s.parent];
        return !!win && win === results?.[s.child];
      }
      case "arrived":
        return !!results?.[s.match];
    }
  };
  // Winner's path in the trophy's green; everything else stays grey.
  const stroke = (s: SolidWhen) =>
    isSolid(s) ? "var(--pick)" : "var(--border-strong)";

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative connectors; structure is conveyed by the labelled nodes it links.
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      {GEOMETRY.arcs.map((a) => (
        <path
          key={a.d}
          d={a.d}
          fill="none"
          stroke={stroke(a.solid)}
          strokeWidth={2.5}
        />
      ))}
      {GEOMETRY.segs.map((s, i) => (
        <line
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is static
          key={i}
          x1={s.a.x}
          y1={s.a.y}
          x2={s.b.x}
          y2={s.b.y}
          stroke={stroke(s.solid)}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// A move is worth showing when the shift from baseline clears ~1 point.
const hasMoved = (c: Candidate) =>
  Math.abs(c.probability - (c.baseline ?? c.probability)) > 0.01;

/** A single team's chance, as a flag + code + bar + percentage — the row style
 *  used across the prediction widgets. Rows fade in and their bars sweep out
 *  from the left when the popover opens. */
function OddsRow({
  c,
  top,
  wideLabel,
}: {
  c: Candidate;
  top: boolean;
  /** Reserve room for a "start -> now" move label so every row's bar track — the
   *  flex-1 remainder — is the same width and the bars stay comparable. */
  wideLabel: boolean;
}) {
  // The white bar always spans the initial value. A rise shows as green added
  // to its right (bar reaches `now`); a fall as red laid over its right edge
  // (the lost slice between `now` and `start`).
  // With no baseline, start equals now, so there's no move and the bar stays solid.
  const now = c.probability;
  const start = c.baseline ?? now;
  const delta = now - start;
  const rose = delta > 0;
  const moved = hasMoved(c);
  const pctLabel = moved
    ? `${formatPctLabel(start)} -> ${formatPctLabel(now)}`
    : formatPctLabel(now);
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
          "shrink-0 whitespace-nowrap pr-0.5 text-right text-xs tabular-nums",
          wideLabel ? "w-24" : "w-10",
          top ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {pctLabel}
      </span>
    </div>
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
      <span
        aria-hidden
        className="size-1.5 shrink-0 animate-pulse rounded-full bg-rose-400"
      />
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
  // Size the label column once for the whole list: only widen for a "start -> now"
  // label when some row actually moved, so equal tracks never cost extra room.
  const wideLabel = shown.some(hasMoved);
  return (
    <div className="relative">
      {live && <LiveBadge className="absolute top-0 right-0" />}
      <PopupHeader title={title} subtitle={subtitle} />
      <div className="space-y-1">
        {shown.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic">no market</p>
        ) : (
          shown.map((c, i) => (
            <OddsRow key={c.code} c={c} top={i === 0} wideLabel={wideLabel} />
          ))
        )}
      </div>
      {shown.length > 0 && (
        // These come from the model simulating the bracket, not the outright
        // winner market — so they can differ from the "champion" card's odds.
        <p className="mt-1.5 text-[10px] tracking-wide text-muted-foreground/45 uppercase">
          Model projection
        </p>
      )}
    </div>
  );
}

// ── Nodes ────────────────────────────────────────────────────────────────────

// Every outer/inner node is the same size; only the centre champion differs.
const NODE_FACTOR = 0.95; // node size as a fraction of --cf
const NODE_SIZE = `calc(var(--cf) * ${NODE_FACTOR})`;

interface NodeToggle {
  open: boolean;
  onToggle: (anchor: HTMLElement) => void;
}

/** The shared entrance pop of a node's content. The delay is frozen at mount
 *  so later renders can't re-time a running animation; remount (a new key) to
 *  replay it with a fresh delay. */
function NodeEntrance({
  delay,
  className,
  children,
}: {
  delay: number;
  className?: string;
  children: ReactNode;
}) {
  const [initial] = useState(delay);
  return (
    <div
      className={cn("animate-predict-in", className)}
      style={initial ? { animationDelay: `${initial}s` } : undefined}
    >
      {children}
    </div>
  );
}

/** A node whose team isn't settled yet. It always contains both layers — the
 *  "?" placeholder and the predicted front-runner's faded flag — stacked on top
 *  of each other, and cross-fades between them when `predict` toggles, so the
 *  two states morph into one another rather than popping in and out. */
function UnsettledNode({
  code,
  predict,
  live,
  open,
  onToggle,
}: NodeToggle & {
  /** Front-runner's flag code, when a market exists for this node. */
  code?: string;
  predict?: boolean;
  /** The node's match is in progress: the leader's flag shows extra-faded so it
   *  never reads as a confirmed result. */
  live?: boolean;
}) {
  const showFlag = !!(predict && code);
  // The cursor-proximity reveal only makes sense when there's a flag beneath
  // the "?" to uncover; with no market the "?" stays put rather than fading
  // to a bare grey disc.
  const proximityReveal = !!code && !showFlag;
  return (
    <button
      type="button"
      onClick={(e) => onToggle(e.currentTarget)}
      aria-label="Show chances"
      aria-expanded={open}
      className="group relative block rounded-full"
      style={{ width: NODE_SIZE, height: NODE_SIZE }}
    >
      {/* "?" layer — stays fully opaque underneath so the crossfade never
          exposes the card behind it; the flag (with its own solid base) simply
          fades in on top, giving a clean A→B transition. */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-surface-2 font-semibold transition-[color,border-color,opacity] duration-300 ease-out",
          open
            ? "border-foreground/65 text-foreground"
            : "border-surface-border text-muted-foreground group-hover:text-foreground",
        )}
        style={{
          width: `calc(${NODE_SIZE} * 0.82)`,
          height: `calc(${NODE_SIZE} * 0.82)`,
          fontSize: `calc(${NODE_SIZE} * 0.42)`,
          // As the cursor nears (--prox → 1) the "?" fades out so the predicted
          // flag reads clean underneath the cursor.
          opacity: proximityReveal ? "calc(1 - var(--prox, 0))" : undefined,
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
          // When the toggle is off, proximity (--prox) fades the flag in as the
          // cursor nears — up to 0.5 so it stays a hint, not a result; when on,
          // it's fully shown regardless of the cursor.
          style={
            proximityReveal
              ? { opacity: "calc(var(--prox, 0) * 0.25)" }
              : undefined
          }
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 ease-out",
            showFlag && (live ? "opacity-30" : "opacity-100"),
          )}
        >
          <RoundFlag
            code={code}
            size={`calc(${NODE_SIZE} * 0.82)`}
            faded
            className={cn(
              "transition-[filter] group-hover:brightness-110",
              open ? "ring-foreground/80" : "ring-surface-divider",
            )}
          />
        </span>
      )}
    </button>
  );
}

/** A team's flag: green-ringed once it has won this node's match, faded once
 *  knocked out at the next stage. Plain unless a tap does something — opening
 *  the team's popover (its run so far, plus the road to the final when still
 *  alive), or selecting the node for the caller. */
function FlagNode({
  code,
  won,
  eliminated,
  explainable,
  selectable,
  hasNote,
  open,
  onToggle,
}: NodeToggle & {
  code: string;
  won: boolean;
  eliminated: boolean;
  explainable: boolean;
  selectable: boolean;
  hasNote: boolean;
}) {
  const ringClass = won ? "ring-pick" : "ring-surface-divider";
  if (!explainable && !selectable && !hasNote)
    return (
      <RoundFlag
        code={code}
        size={NODE_SIZE}
        className={cn(ringClass, eliminated && "opacity-40")}
      />
    );
  let label: string;
  if (explainable) label = `Show ${code}'s World Cup run`;
  else if (hasNote) label = `Show why ${code} was picked`;
  else label = `Select ${code}`;
  return (
    <button
      type="button"
      onClick={(e) => onToggle(e.currentTarget)}
      aria-label={label}
      aria-expanded={open}
      className="group block rounded-full"
    >
      <RoundFlag
        code={code}
        size={NODE_SIZE}
        className={cn(
          "transition-[filter] group-hover:brightness-110",
          open ? "ring-foreground/80" : ringClass,
          eliminated && "opacity-40",
        )}
      />
    </button>
  );
}

/** A node still waiting on its data: a plain pulsing circle, kept distinct from
 *  the "?" so loading never reads as an undecided match. Sits under the real node
 *  and fades out as it arrives, so it pulses only while `pulse` is set. */
function NodeSkeleton({
  pulse = true,
  className,
  style,
}: {
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
      style={{ width: NODE_SIZE, height: NODE_SIZE, ...style }}
    />
  );
}

// ── Cursor-proximity "magnetism" ─────────────────────────────────────────────
// Nodes near the cursor grow up to MAX_GROW px, falling off with a Gaussian in
// viewBox space so the effect tapers smoothly across neighbours.

const MAX_GROW = 6;
const PROXIMITY_SIGMA = 120; // falloff radius, in viewBox units

/** A ring node: centre in viewBox coordinates, base size as a fraction of
 *  --cf (a flag fills the node, an unsettled "?" is smaller). */
interface RingNode {
  x: number;
  y: number;
  factor: number;
  el: HTMLElement;
}

const ProximityContext = createContext<ProximityField<RingNode> | null>(null);

/** The --cf value (px) for a container width — mirrors the CSS
 *  `clamp(20px, 7.2cqw, 44px)`, so growth can be sized without reading boxes. */
function cfPx(width: number): number {
  return Math.max(20, Math.min((7.2 * width) / 100, 44));
}

function scaleByProximity(node: RingNode, cursor: Cursor, rect: DOMRect) {
  let scale = 1;
  // 0..1 nearness, exposed as --prox so an unsettled node can fade in its
  // predicted (favourite) flag as the cursor approaches — the same flag the
  // market-predictions toggle reveals, but keyed to proximity instead.
  let prox = 0;
  if (cursor) {
    const x = (cursor.x / rect.width) * SIZE;
    const y = (cursor.y / rect.height) * SIZE;
    const d = Math.hypot(x - node.x, y - node.y);
    const f = Math.exp(-(d * d) / (2 * PROXIMITY_SIGMA * PROXIMITY_SIGMA));
    prox = f;
    const base = cfPx(rect.width) * node.factor;
    if (f > 0.01) scale = (base + MAX_GROW * f) / base;
  }
  node.el.style.transform = `scale(${round2(scale)})`;
  node.el.style.setProperty("--prox", String(round2(prox)));
}

/** Ref callback that registers a node's positioned wrapper with the field. */
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
      if (el) field.register(id, { x, y, factor, el });
      else field.unregister(id);
    },
    [field, id, x, y, factor],
  );
}

// ── The bracket ──────────────────────────────────────────────────────────────

/** What a node paints, derived from the props. A `team` shows as a full flag
 *  (green-ringed when `won`); otherwise `candidates` feed the "?" overlay. */
interface NodeModel {
  ref: BracketNodeRef;
  x: number;
  y: number;
  team?: TeamCode;
  won: boolean;
  eliminated: boolean;
  candidates?: Candidate[];
  live: boolean;
  liveLeaderCode?: TeamCode;
  /** A note to reveal on tap (e.g. a pick's reasoning). */
  note?: string;
}

const nodeId = (ref: BracketNodeRef) =>
  ref.side ? slotKey(ref.match, ref.side) : String(ref.match);

const asCandidates = (p?: Prediction) => (Array.isArray(p) ? p : undefined);
const asGuess = (p?: Prediction) => (typeof p === "string" ? p : undefined);

function slotModel(pos: SlotPos, props: CircularBracketProps): NodeModel {
  const team = props.slots?.[slotKey(pos.match, pos.side)];
  const winner = props.results?.[pos.match];
  return {
    ref: { match: pos.match, side: pos.side },
    x: pos.x,
    y: pos.y,
    team,
    won: !!team && winner === team,
    eliminated: !!team && !!winner && winner !== team,
    live: props.live?.has(pos.match) ?? false,
    liveLeaderCode: props.liveLeader?.get(pos.match),
    note: props.nodeNote?.({ match: pos.match, side: pos.side }),
  };
}

function matchModel(pos: MatchPos, props: CircularBracketProps): NodeModel {
  const winner = props.results?.[pos.match];
  const prediction = props.predictions?.[pos.match];
  const team = winner ?? asGuess(prediction);
  const next = matchByNumber[pos.match].feedsInto;
  const nextWinner = next ? props.results?.[next] : undefined;
  return {
    ref: { match: pos.match },
    x: pos.x,
    y: pos.y,
    team,
    won: !!winner,
    eliminated: !!team && !!nextWinner && nextWinner !== team,
    candidates: winner ? undefined : asCandidates(prediction),
    live: props.live?.has(pos.match) ?? false,
    liveLeaderCode: props.liveLeader?.get(pos.match),
    note: props.nodeNote?.({ match: pos.match }),
  };
}

/** One bracket node: a skeleton while its data loads, a full flag once the team
 *  is known (or guessed), or a tappable "?" onto the chances in between. The node
 *  ripples in once on mount with the skeleton already in place; the content pops
 *  in over the same spot — wave-staggered when the data arrives, immediately when
 *  a pick or result changes it later. */
function BracketNode({
  model,
  loading,
  staggered,
  predict,
  explainable,
  selectable,
  open,
  onToggle,
}: NodeToggle & {
  model: NodeModel;
  loading: boolean;
  /** Wave-delay the content entrance (the data is replacing the skeletons). */
  staggered: boolean;
  predict?: boolean;
  explainable: boolean;
  selectable: boolean;
}) {
  // Reuse the mount ripple's outside→inside timing so the nodes wave in from the
  // edge when the data arrives, rather than all settling from skeleton at once.
  const wave = rippleDelay(model.x, model.y);
  // The skeleton never fades to empty: it stays opaque and shrinks to the loaded
  // node's base size as the (opaque-based) content pops in on top, so it ends up
  // fully covered. A flag fills the whole node; an unsettled "?" is smaller.
  const settleScale = loading || model.team ? 1 : 0.82;
  const id = nodeId(model.ref);
  const proximityRef = useProximityRef(id, model.x, model.y, NODE_FACTOR);
  return (
    <div
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: pct(model.x), top: pct(model.y) }}
    >
      {/* The mount ripple lives on its own element so it never clashes with the
          positioning wrapper's centring transform. */}
      <div
        className="animate-predict-in"
        style={{ animationDelay: `${wave}s` }}
      >
        <div
          ref={proximityRef}
          className="relative grid place-items-center transition-transform duration-150 ease-out will-change-transform"
          style={{ width: NODE_SIZE, height: NODE_SIZE }}
        >
          <NodeSkeleton
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
            // One entrance for whatever the node settles into, keyed by team so
            // a changed pick or result replays it (immediately — no stagger).
            <NodeEntrance
              key={model.team ?? "open"}
              delay={staggered ? wave : 0}
              className="col-start-1 row-start-1"
            >
              {model.team ? (
                <FlagNode
                  code={model.team}
                  won={model.won}
                  eliminated={model.eliminated}
                  explainable={explainable}
                  selectable={selectable}
                  hasNote={!!model.note}
                  open={open}
                  onToggle={onToggle}
                />
              ) : (
                <UnsettledNode
                  code={model.liveLeaderCode ?? model.candidates?.[0]?.code}
                  predict={predict || !!model.liveLeaderCode}
                  live={model.live}
                  open={open}
                  onToggle={onToggle}
                />
              )}
            </NodeEntrance>
          )}
        </div>
      </div>
    </div>
  );
}

/** The centre: a same-size circle holding the trophy (or the champion's flag),
 *  opening the title odds on tap. A guessed champion shows without the green
 *  ring, like every other predicted winner. */
function ChampionNode({
  team,
  won,
  open,
  onToggle,
}: NodeToggle & { team?: TeamCode; won: boolean }) {
  const proximityRef = useProximityRef("champion", C, C, 1);
  return (
    <div className="absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
      <div
        ref={proximityRef}
        className="transition-transform duration-150 ease-out will-change-transform"
      >
        <button
          type="button"
          onClick={(e) => onToggle(e.currentTarget)}
          aria-label="Show title odds"
          aria-expanded={open}
          className={cn(
            "block rounded-full",
            team && won && "ring-2 ring-pick",
          )}
        >
          {/* The nodes' shared entrance, keyed so a new champion replays it. */}
          <NodeEntrance key={team ?? "trophy"} delay={0}>
            {team ? (
              <RoundFlag code={team} size="var(--cf)" />
            ) : (
              <span
                className={cn(
                  "flex size-(--cf) items-center justify-center rounded-full border bg-card transition-colors",
                  open
                    ? "border-pick text-pick"
                    : "border-pick/50 text-pick/80",
                )}
              >
                <Trophy style={{ width: "55%", height: "55%" }} />
              </span>
            )}
          </NodeEntrance>
        </button>
      </div>
    </div>
  );
}

/** A node's note (e.g. why a team was picked): the picked team and match as a
 *  header, then the note itself. */
function NotePopup({
  code,
  subtitle,
  text,
}: {
  code?: string;
  subtitle: string;
  text: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {code && <RoundFlag code={code} size="16px" />}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium tracking-wide text-foreground/80">
            {code ?? "Pick"}
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

/** The popover content for an open node, or `null` when it has nothing to show:
 *  a note when one is provided; otherwise a locked-in (or guessed) team's run so
 *  far and road to the final, or an undecided match's chances list. */
function popoverContent(
  ref: BracketNodeRef,
  props: CircularBracketProps,
): ReactNode {
  const note = props.nodeNote?.(ref);
  if (note) {
    const pick = ref.side
      ? props.slots?.[slotKey(ref.match, ref.side)]
      : asGuess(props.predictions?.[ref.match]);
    return (
      <NotePopup code={pick} subtitle={matchSubtitle(ref.match)} text={note} />
    );
  }

  const team = ref.side
    ? props.slots?.[slotKey(ref.match, ref.side)]
    : (props.results?.[ref.match] ?? asGuess(props.predictions?.[ref.match]));
  const path = team ? props.teamPaths?.get(team) : undefined;
  const journey = team ? props.teamJourneys?.get(team) : undefined;
  if (path || journey) return <TeamPopup journey={journey} path={path} />;

  // Slots carry no market of their own, and a decided match's odds are history.
  if (ref.side || props.results?.[ref.match]) return null;
  const odds = asCandidates(props.predictions?.[ref.match]);
  if (!odds) return null;
  const round = matchByNumber[ref.match].round as RoundKey;
  return (
    <OddsList
      title={
        ref.match === FINAL
          ? "Chances to win the title"
          : `Chances to reach the ${NEXT_LABEL[round]}`
      }
      subtitle={matchSubtitle(ref.match)}
      odds={odds}
      live={props.live?.has(ref.match)}
    />
  );
}

/** The knockout bracket as an interactive ring — connectors, nodes, the centre
 *  champion and the popover each opens on tap. Sizing is container-relative
 *  (cqw) so it fills whatever width its parent gives it; pass `className` to
 *  cap or pad it. */
export function CircularBracket(props: CircularBracketProps) {
  const {
    isLoading = false,
    predict,
    teamPaths,
    teamJourneys,
    onNodeSelect,
    className,
  } = props;
  const [open, setOpen] = useState<{
    ref: BracketNodeRef;
    anchor: HTMLElement;
  } | null>(null);
  const toggle = (ref: BracketNodeRef) => (anchor: HTMLElement) => {
    onNodeSelect?.(ref);
    setOpen((cur) =>
      cur && nodeId(cur.ref) === nodeId(ref) ? null : { ref, anchor },
    );
  };
  const openId = open ? nodeId(open.ref) : null;
  // A flag is tappable when we have something to show for it: a road to the
  // final (still alive) or a played-so-far run (any team that has kicked off).
  const explainable = (model: NodeModel) =>
    !!model.team &&
    (!!teamPaths?.has(model.team) || !!teamJourneys?.has(model.team));
  // With a select callback, every team flag is tappable, not just explainable ones.
  const selectable = !!onNodeSelect;
  // Node entrances are wave-staggered only on the render where the data replaces
  // the loading skeletons; afterwards (a pick, a live result) they pop
  // immediately. Derived during render from the previous isLoading value so the
  // stagger doesn't depend on an effect committing between renders.
  const [prevLoading, setPrevLoading] = useState(isLoading);
  const staggered = prevLoading;
  if (prevLoading !== isLoading) setPrevLoading(isLoading);

  const { containerRef, field, onPointerMove, onPointerLeave } =
    useProximityField(scaleByProximity);

  const champion =
    props.results?.[FINAL] ?? asGuess(props.predictions?.[FINAL]);
  // Resolved every render (not captured on tap) so an open popover's odds keep
  // refreshing with the props; no content means the tap selects but opens nothing.
  const popover = open ? popoverContent(open.ref, props) : null;

  return (
    <>
      {/* Sizes are container-relative (cqw), so the whole ring fits any width
          without scrolling and the flags scale up with it. */}
      <div
        ref={containerRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className={cn(
          "relative mx-auto aspect-square w-full [--cf:clamp(20px,7.2cqw,44px)] @container",
          className,
        )}
      >
        {/* A soft glow from the centre that barely lifts the background, fading
            out by ~1/3 of the ring radius (16.7cqw ≈ R/3). The stops follow an
            ease-out (~(1−t)²) curve rather than a linear ramp: grey isn't
            perceived linearly, so a linear falloff would read as a hard ring. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle 30cqw at center, oklch(1 0 0 / 0.12) 0%, oklch(1 0 0 / 0.06) 25%, oklch(1 0 0 / 0.04) 50%, oklch(1 0 0 / 0.02) 75%, transparent 100%)",
          }}
        />
        <ProximityContext.Provider value={field}>
          <Connectors slots={props.slots} results={props.results} />
          {GEOMETRY.matches.map((pos) => {
            const model = matchModel(pos, props);
            return (
              <BracketNode
                key={nodeId(model.ref)}
                model={model}
                loading={isLoading}
                staggered={staggered}
                predict={predict}
                explainable={explainable(model)}
                selectable={selectable}
                open={openId === nodeId(model.ref)}
                onToggle={toggle(model.ref)}
              />
            );
          })}
          {GEOMETRY.slots.map((pos) => {
            const model = slotModel(pos, props);
            return (
              <BracketNode
                key={nodeId(model.ref)}
                model={model}
                loading={isLoading}
                staggered={staggered}
                predict={predict}
                explainable={explainable(model)}
                selectable={selectable}
                open={openId === nodeId(model.ref)}
                onToggle={toggle(model.ref)}
              />
            );
          })}
          <ChampionNode
            team={champion}
            won={!!props.results?.[FINAL]}
            open={openId === String(FINAL)}
            onToggle={toggle({ match: FINAL })}
          />
        </ProximityContext.Provider>
      </div>
      <Popover
        open={!!popover}
        anchor={open?.anchor ?? null}
        onClose={() => setOpen(null)}
        className="w-[min(20rem,calc(100vw-1rem))] p-2.5"
      >
        {popover}
      </Popover>
    </>
  );
}

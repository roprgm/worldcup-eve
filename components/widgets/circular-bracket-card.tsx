"use client";

import { cn } from "cnfast";
import { addMinutes, format } from "date-fns";
import { Info, Trophy } from "lucide-react";
import { useState } from "react";

import { Flag } from "@/components/flags";
import { Popover } from "@/components/ui/popover";
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
// Every node is one full-size circle, so the rings are spaced more than a
// diameter apart to keep them from touching toward the centre.
const RING: Record<RoundKey, number> = { R32: 338, R16: 255, QF: 175, SF: 100 };
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
}

/** Everything the card paints onto the skeleton: the candidates for each R32
 *  slot, the teams that could reach each match, the real winner of any finished
 *  match, and the title odds. */
export interface CircularBracketView {
  slotOdds: Map<string, Candidate[]>; // "match:side" → R32 occupant candidates
  matchOdds: Map<number, Candidate[]>; // match → each contender's chance to win
  decided: Map<number, Candidate>; // match → real winner, once played
  championOdds: Candidate[];
}

const pct = (v: number) => `${(v / SIZE) * 100}%`;
const formatPct = (p: number) => `${Math.round(p * 100)}%`;
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
            // Winner's path in foreground; everything else stays grey but solid.
            stroke={solid ? "var(--foreground)" : "var(--border-strong)"}
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
            // Winner's path in foreground; everything else stays grey but solid.
            stroke={solid ? "var(--foreground)" : "var(--border-strong)"}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** A single team's chance, as a flag + code + bar + percentage — the row style
 *  used across the prediction widgets. */
function OddsRow({ c, top }: { c: Candidate; top: boolean }) {
  return (
    <div className="flex h-5 items-center gap-1.5">
      <RoundFlag code={c.code} size="14px" />
      <span
        title={c.name}
        className={cn(
          "w-7 shrink-0 text-[11px] font-semibold tracking-wide",
          top ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {c.code}
      </span>
      <span className="flex h-1.5 flex-1 overflow-hidden rounded-[1px] bg-muted/50">
        <span
          className={cn(
            "h-full rounded-[1px]",
            top ? "bg-pick" : "bg-muted-foreground/30",
          )}
          style={{ width: formatPct(c.probability) }}
        />
      </span>
      <span
        className={cn(
          "min-w-8 text-right text-[11px] tabular-nums",
          top ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {formatPct(c.probability)}
      </span>
    </div>
  );
}

/** The body of a chances popover: which match it is, then a titled ranked list. */
function OddsList({
  title,
  subtitle,
  odds,
}: {
  title: string;
  subtitle?: string;
  odds: Candidate[];
}) {
  const shown = odds.filter((c) => c.probability >= 0.01).slice(0, 8);
  return (
    <>
      <p className="text-[11px] font-medium tracking-wide text-foreground/80">
        {title}
      </p>
      {subtitle && (
        <p className="mb-1.5 text-[10px] text-muted-foreground/70">
          {subtitle}
        </p>
      )}
      <div className={cn("space-y-1", !subtitle && "mt-1.5")}>
        {shown.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/50 italic">
            no market
          </p>
        ) : (
          shown.map((c, i) => <OddsRow key={c.code} c={c} top={i === 0} />)
        )}
      </div>
    </>
  );
}

interface NodeProps {
  openId: string | null;
  onToggle: (id: string, anchor: HTMLElement) => void;
}

/** A node whose team isn't settled yet: a full-size circle with a question mark,
 *  the same footprint as a flag, that opens its chances on tap. */
function UnknownNode({
  id,
  size = "var(--cf)",
  openId,
  onToggle,
}: NodeProps & { id: string; size?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => onToggle(id, e.currentTarget)}
      aria-label="Show chances"
      aria-expanded={openId === id}
      className={cn(
        "flex items-center justify-center rounded-full border bg-surface-2 font-semibold transition-colors",
        openId === id
          ? "border-pick/60 text-pick"
          : "border-surface-border text-muted-foreground hover:text-foreground",
      )}
      style={{
        width: `calc(${size} * 0.7)`,
        height: `calc(${size} * 0.7)`,
        fontSize: `calc(${size} * 0.42)`,
      }}
    >
      ?
    </button>
  );
}

/** A node whose team isn't settled yet, in "predict" mode: the current
 *  front-runner's flag shown faded, so it reads as a likely outcome rather than
 *  a locked-in result. Still opens the full chances on tap. */
function PredictedNode({
  id,
  code,
  size = "var(--cf)",
  openId,
  onToggle,
}: NodeProps & { id: string; code: string; size?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => onToggle(id, e.currentTarget)}
      aria-label="Show chances"
      aria-expanded={openId === id}
      className={cn(
        "group relative block rounded-full",
        openId === id && "ring-2 ring-pick/60",
      )}
    >
      {/* Solid opaque base (in RoundFlag) covers the connector lines; the flag
          image on top is faded so the node reads as a prediction. */}
      <RoundFlag
        code={code}
        size={size}
        faded
        className="border border-dashed border-surface-border transition-[filter] group-hover:brightness-110"
      />
    </button>
  );
}

/** An outer Round-of-32 slot: the team's flag once the group is decided, else a
 *  question-mark circle (or, in `predict` mode, the faded front-runner's flag)
 *  onto the candidates for that spot. */
function SlotNode({
  pos,
  view,
  predict,
  openId,
  onToggle,
}: NodeProps & { pos: FlagPos; view?: CircularBracketView; predict?: boolean }) {
  const odds = view?.slotOdds.get(`${pos.match}:${pos.side}`);
  const top = lead(odds);
  const id = `slot:${pos.match}:${pos.side}`;
  // Outer ring slots shrink slightly (less than the inner match nodes).
  const size = "calc(var(--cf) * 0.9)";
  return (
    <div
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: pct(pos.x), top: pct(pos.y) }}
    >
      {confirmed(odds) && top ? (
        <RoundFlag code={top.code} size={size} />
      ) : predict && top ? (
        <PredictedNode
          id={id}
          code={top.code}
          size={size}
          openId={openId}
          onToggle={onToggle}
        />
      ) : (
        <UnknownNode id={id} size={size} openId={openId} onToggle={onToggle} />
      )}
    </div>
  );
}

/** An inner match: the winner's flag once it's played, else a question-mark
 *  circle onto the teams that could still reach it. */
function MatchNode({
  node,
  view,
  predict,
  openId,
  onToggle,
}: NodeProps & {
  node: InnerNode;
  view?: CircularBracketView;
  predict?: boolean;
}) {
  const win = view?.decided.get(node.match);
  const top = lead(view?.matchOdds.get(node.match));
  const id = `match:${node.match}`;
  // Inner match nodes render a touch smaller than the outer ring of slots.
  const size = "calc(var(--cf) * 0.8)";
  return (
    <div
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: pct(node.x), top: pct(node.y) }}
    >
      {win ? (
        <RoundFlag code={win.code} size={size} />
      ) : predict && top ? (
        <PredictedNode
          id={id}
          code={top.code}
          size={size}
          openId={openId}
          onToggle={onToggle}
        />
      ) : (
        <UnknownNode id={id} size={size} openId={openId} onToggle={onToggle} />
      )}
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
  return (
    <div
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: "50%", top: "50%" }}
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
            isOpen ? "border-pick text-pick" : "border-pick/50 text-pick/80",
          )}
        >
          <Trophy style={{ width: "55%", height: "55%" }} />
        </button>
      )}
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
): { title: string; subtitle: string; odds: Candidate[] } | null {
  if (id === "champion")
    return {
      title: "Chances to win the title",
      subtitle: matchSubtitle(104),
      odds: view.championOdds,
    };
  if (id.startsWith("slot:")) {
    const sideKey = id.slice("slot:".length);
    const odds = view.slotOdds.get(sideKey);
    if (!odds) return null;
    return {
      title: "Chances to reach this match",
      subtitle: matchSubtitle(Number(sideKey.split(":")[0])),
      odds,
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
  };
}

const HELP_TEXT =
  "Tap any node to see each team's chance of reaching that match. The chances are computed from the betting market and refresh every minute.";

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
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          {/* Above the bracket nodes (z-30), which the card isolates. */}
          <div className="absolute top-full right-0 z-50 mt-1.5 w-64 rounded-md border border-surface-border bg-surface-2 p-2 text-[10px] leading-relaxed text-muted-foreground shadow-lg">
            {HELP_TEXT}
          </div>
        </>
      )}
    </div>
  );
}

/** The knockout bracket as a ring of flags and chevrons. Structure renders
 *  immediately; flags lock in and chances open as the market resolves. */
export function CircularBracketCard({
  view,
  predict,
}: {
  view?: CircularBracketView;
  /** Show the leading candidate's flag (faded) in unsettled nodes instead of a
   *  "?" — reads as a prediction rather than a confirmed result. */
  predict?: boolean;
}) {
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement } | null>(
    null,
  );
  const onToggle = (id: string, anchor: HTMLElement) =>
    setOpen((cur) => (cur?.id === id ? null : { id, anchor }));
  const openId = open?.id ?? null;
  const content = open && view ? openContent(view, open.id) : null;

  return (
    // `isolate` keeps the nodes' z-index inside this card so they don't paint
    // over the page's sticky section header.
    <div className="isolate overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center gap-1.5 border-b border-surface-divider px-3">
        <span className="shrink-0 text-[11px] font-medium tracking-wide text-foreground/70">
          Prediction bracket
        </span>
        <span className="min-w-0 truncate text-[10px] text-muted-foreground/55">
          · tap a node to see its chances
        </span>
        <CircularBracketHelp />
      </div>
      <div className="px-2 py-4 sm:px-3">
        {/* Sizes are container-relative (cqw), so the whole ring fits any width
            without scrolling and the flags scale up with it. */}
        <div className="relative mx-auto aspect-square w-full max-w-[680px] [--cf:clamp(20px,7.2cqw,44px)] [container-type:inline-size]">
          <Connectors view={view} />
          {GEOMETRY.nodes.map((node) => (
            <MatchNode
              key={node.match}
              node={node}
              view={view}
              predict={predict}
              openId={openId}
              onToggle={onToggle}
            />
          ))}
          {GEOMETRY.flags.map((pos) => (
            <SlotNode
              key={`${pos.match}:${pos.side}`}
              pos={pos}
              view={view}
              predict={predict}
              openId={openId}
              onToggle={onToggle}
            />
          ))}
          <ChampionNode view={view} openId={openId} onToggle={onToggle} />
        </div>
      </div>
      {open && content && (
        <Popover
          key={open.id}
          anchor={open.anchor}
          onClose={() => setOpen(null)}
          className="w-56 p-2.5"
        >
          <OddsList
            title={content.title}
            subtitle={content.subtitle}
            odds={content.odds}
          />
        </Popover>
      )}
    </div>
  );
}

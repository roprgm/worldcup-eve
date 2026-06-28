"use client";

import { cn } from "cnfast";
import { ChevronDown, Info, Trophy } from "lucide-react";
import { useState } from "react";

import { Flag } from "@/components/flags";
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
const GAP = 18;
const R_FLAG = 432; // outer ring: the 32 team slots
type RoundKey = "R32" | "R16" | "QF" | "SF";
const RING: Record<RoundKey, number> = { R32: 326, R16: 240, QF: 156, SF: 82 };
const ROUND_LABEL: Record<RoundKey, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
};
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

// What flows along a connector, so the card can light up the champion's path: a
// Round-of-32 team slot, or the winner of an inner match.
type Owner =
  | { kind: "slot"; match: number; side: Side }
  | { kind: "match"; match: number };

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  owner: Owner;
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
  arcs: string[];
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
  const arcs: string[] = [];
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
        // R32: a spoke out to each flag, the bar joining the two flags.
        for (const side of ["home", "away"] as Side[]) {
          const fa = flagAngle.get(`${num}:${side}`)!;
          const inner = polar(fa, rN);
          const outer = polar(fa, R_FLAG);
          segs.push({
            x1: inner.x,
            y1: inner.y,
            x2: outer.x,
            y2: outer.y,
            owner: { kind: "slot", match: num, side },
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
          segs.push({
            x1: inner.x,
            y1: inner.y,
            x2: outer.x,
            y2: outer.y,
            owner: { kind: "match", match: cm },
          });
        }
        arcs.push(
          arcPath(rN, nodeAngle.get(kids[0])!, nodeAngle.get(kids[1])!),
        );
      }
    }
  }

  // The final: each semi runs straight to the centre, where the champion sits.
  for (const sf of [LEFT.root, RIGHT.root]) {
    const p = polar(sfAngle.get(sf)!, RING.SF);
    segs.push({
      x1: C,
      y1: C,
      x2: p.x,
      y2: p.y,
      owner: { kind: "match", match: sf },
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
 *  slot, the win odds for each match, and the title odds. */
export interface CircularBracketView {
  slotOdds: Map<string, Candidate[]>; // "match:side" → R32 occupant candidates
  matchOdds: Map<number, Candidate[]>; // match → chance each team wins it
  championOdds: Candidate[];
}

const pct = (v: number) => `${(v / SIZE) * 100}%`;
const formatPct = (p: number) => `${Math.round(p * 100)}%`;
const lead = (odds?: Candidate[]) => odds?.[0];
const confirmed = (odds?: Candidate[]) =>
  (lead(odds)?.probability ?? 0) >= CONFIRMED;

/** The team that flows along a connector, for the champion-path highlight. */
function ownerCode(view: CircularBracketView | undefined, owner: Owner) {
  if (!view) return undefined;
  return owner.kind === "slot"
    ? lead(view.slotOdds.get(`${owner.match}:${owner.side}`))?.code
    : lead(view.matchOdds.get(owner.match))?.code;
}

function Connectors({
  view,
  champ,
}: {
  view?: CircularBracketView;
  champ?: string;
}) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative connectors; structure is conveyed by the labelled nodes it links.
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
        const on = champ != null && ownerCode(view, s.owner) === champ;
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

/** A single team's chance, as a flag + code + bar + percentage — the row style
 *  used across the prediction widgets. */
function OddsRow({ c, top }: { c: Candidate; top: boolean }) {
  return (
    <div className="flex h-5 items-center gap-1.5">
      <Flag code={c.code} size={14} />
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

/** The chances popover, anchored to its node and opening toward the centre so
 *  it stays inside the widget. */
function OddsPopover({
  title,
  odds,
  x,
  y,
}: {
  title: string;
  odds: Candidate[];
  x: number;
  y: number;
}) {
  const shown = odds.filter((c) => c.probability >= 0.01).slice(0, 6);
  const horizontal =
    x < C ? { left: "calc(100% + 6px)" } : { right: "calc(100% + 6px)" };
  const vertical = y < C ? { top: "-6px" } : { bottom: "-6px" };
  return (
    <div
      className="absolute z-40 w-44 rounded-md border border-surface-border bg-surface-2 p-2 shadow-lg"
      style={{ ...horizontal, ...vertical }}
    >
      <p className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
        {title}
      </p>
      <div className="space-y-1">
        {shown.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/50 italic">
            no market
          </p>
        ) : (
          shown.map((c, i) => <OddsRow key={c.code} c={c} top={i === 0} />)
        )}
      </div>
    </div>
  );
}

/** A small expander shown where a team isn't locked in yet: a chevron that opens
 *  that node's chances. */
function ChevronButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Show chances"
      aria-expanded={open}
      className={cn(
        "flex size-[var(--node)] items-center justify-center rounded-full border bg-surface-2 transition-colors",
        open
          ? "border-pick/50 text-pick"
          : "border-surface-border text-muted-foreground hover:text-foreground",
      )}
    >
      <ChevronDown
        className={cn("size-3 transition-transform", open && "rotate-180")}
      />
    </button>
  );
}

interface NodeProps {
  openId: string | null;
  setOpen: (id: string | null) => void;
  champ?: string;
}

/** An outer Round-of-32 slot: the team's flag once the group is decided, else a
 *  chevron onto the candidates for that spot. */
function SlotNode({
  pos,
  view,
  openId,
  setOpen,
  champ,
}: NodeProps & { pos: FlagPos; view?: CircularBracketView }) {
  const id = `slot:${pos.match}:${pos.side}`;
  const odds = view?.slotOdds.get(`${pos.match}:${pos.side}`);
  const top = lead(odds);
  const isOpen = openId === id;
  const isChamp = top?.code != null && top.code === champ;
  return (
    <div
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: pct(pos.x), top: pct(pos.y) }}
    >
      {confirmed(odds) && top ? (
        <Flag
          code={top.code}
          size="var(--cf)"
          className={cn("block rounded-full", isChamp && "ring-2 ring-pick")}
        />
      ) : (
        <ChevronButton
          open={isOpen}
          onClick={() => setOpen(isOpen ? null : id)}
        />
      )}
      {isOpen && odds && (
        <OddsPopover
          title="Reaches this match"
          odds={odds}
          x={pos.x}
          y={pos.y}
        />
      )}
    </div>
  );
}

/** An inner match: the winner's flag once it's played, else a chevron onto the
 *  chance each team wins it. */
function MatchNode({
  node,
  view,
  openId,
  setOpen,
  champ,
}: NodeProps & { node: InnerNode; view?: CircularBracketView }) {
  const id = `match:${node.match}`;
  const odds = view?.matchOdds.get(node.match);
  const top = lead(odds);
  const isOpen = openId === id;
  const isChamp = top?.code != null && top.code === champ;
  return (
    <div
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: pct(node.x), top: pct(node.y) }}
    >
      {confirmed(odds) && top ? (
        <Flag
          code={top.code}
          size="var(--cfi)"
          className={cn(
            "block rounded-full ring-1 ring-surface-border",
            isChamp && "ring-2 ring-pick",
          )}
        />
      ) : (
        <ChevronButton
          open={isOpen}
          onClick={() => setOpen(isOpen ? null : id)}
        />
      )}
      {isOpen && odds && (
        <OddsPopover
          title={`${ROUND_LABEL[node.round]} · wins`}
          odds={odds}
          x={node.x}
          y={node.y}
        />
      )}
    </div>
  );
}

/** The centre: the trophy, with the champion's flag once decided, otherwise a
 *  chevron onto the title odds. */
function ChampionNode({
  view,
  openId,
  setOpen,
}: NodeProps & { view?: CircularBracketView }) {
  const odds = view?.championOdds;
  const top = lead(odds);
  const isOpen = openId === "champion";
  const done = confirmed(odds) && top;
  return (
    <div
      className="absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-pick/40 bg-card px-2.5 py-1.5 shadow-lg ring-1 ring-pick/10"
      style={{ left: "50%", top: "50%" }}
    >
      <Trophy
        className={cn("size-4", top ? "text-pick" : "text-muted-foreground/40")}
      />
      {done ? (
        <>
          <Flag
            code={top.code}
            size="var(--cf)"
            className="block rounded-full"
          />
          <span className="text-[11px] font-semibold text-pick">
            {top.name ?? top.code}
          </span>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(isOpen ? null : "champion")}
          aria-label="Show title odds"
          aria-expanded={isOpen}
          className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
        >
          Title odds
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
      )}
      {isOpen && odds && (
        <div className="absolute top-full left-1/2 z-40 mt-1.5 w-44 -translate-x-1/2 rounded-md border border-surface-border bg-surface-2 p-2 shadow-lg">
          <p className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
            Champion
          </p>
          <div className="space-y-1">
            {odds
              .filter((c) => c.probability >= 0.01)
              .slice(0, 6)
              .map((c, i) => (
                <OddsRow key={c.code} c={c} top={i === 0} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

const HELP_TEXT =
  "The knockout bracket as a ring: the Round of 32 on the outside, merging inward to the trophy. A locked-in team shows its flag; until then, open the chevron to see that match's chances.";

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

/** The knockout bracket as a ring of flags and chevrons. Structure renders
 *  immediately; flags lock in and chances open as the market resolves. */
export function CircularBracketCard({ view }: { view?: CircularBracketView }) {
  const [openId, setOpen] = useState<string | null>(null);
  const champ = lead(view?.championOdds)?.code;
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center gap-1.5 border-b border-surface-divider px-3">
        <span className="shrink-0 text-[11px] font-medium tracking-wide text-foreground/70">
          Prediction bracket
        </span>
        <span className="min-w-0 truncate text-[10px] text-muted-foreground/55">
          · open a node to see its chances
        </span>
        <CircularBracketHelp />
      </div>
      {/* Below the min-width the circle would cram, so it scrolls instead. */}
      <div className="overflow-x-auto px-3 py-4">
        <div className="relative mx-auto aspect-square w-full min-w-[460px] max-w-[680px] [--cf:22px] [--cfi:16px] [--node:18px] sm:[--cf:26px] sm:[--cfi:18px] sm:[--node:20px] lg:[--cf:30px] lg:[--cfi:20px] lg:[--node:22px]">
          <Connectors view={view} champ={champ} />
          {openId !== null && (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className="absolute inset-0 z-20 cursor-default"
              onClick={() => setOpen(null)}
            />
          )}
          {GEOMETRY.nodes.map((node) => (
            <MatchNode
              key={node.match}
              node={node}
              view={view}
              openId={openId}
              setOpen={setOpen}
              champ={champ}
            />
          ))}
          {GEOMETRY.flags.map((pos) => (
            <SlotNode
              key={`${pos.match}:${pos.side}`}
              pos={pos}
              view={view}
              openId={openId}
              setOpen={setOpen}
              champ={champ}
            />
          ))}
          <ChampionNode
            view={view}
            openId={openId}
            setOpen={setOpen}
            champ={champ}
          />
        </div>
      </div>
    </div>
  );
}

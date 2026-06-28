"use client";

import { cn } from "cnfast";
import { Check, Info, Trophy } from "lucide-react";
import { type CSSProperties, useState } from "react";

import { Flag } from "@/components/flags";
import { type KnockoutMatch, matchByNumber } from "@/lib/tournament";

// Geometry is driven by CSS variables set on the root (see BracketCard), so the
// whole bracket scales with the breakpoint. --flag is the flag column width,
// --pct the (wider) probability column, --leaf the vertical slot a Round-of-32
// match reserves, --card the full card width, --lane the gap that holds an
// R32→R16 connector, and --step the horizontal stride between inner columns.
const VAR = {
  flag: "var(--flag)",
  pct: "var(--pct)",
  leaf: "var(--leaf)",
  card: "var(--card)",
  lane: "var(--lane)",
  step: "var(--step)",
};

// The inner stride fills the available width. Two regimes, picked by `min`:
//  - narrow: the R32→R16 step stays pinned at BASE (R32 is packed, no room to
//    spread), so the six remaining strides fill: (100% − 3·card − 2·lane)/6;
//  - wide: all eight strides grow together and split the width: (100% − card)/8,
//    so R32 and R16 separate like the rest instead of staying glued.
// They cross exactly where the stride reaches BASE, so the switch is seamless.
// A floor keeps adjacent rounds from colliding when too narrow to fill (below it
// the bracket scrolls). 100% resolves against the bracket container.
const STEP_VALUE = `max(calc(${VAR.card} * 0.58), min(calc((100% - 3 * ${VAR.card} - 2 * ${VAR.lane}) / 6), calc((100% - ${VAR.card}) / 8)))`;

// A round's column index, left to right: R32→SF on the left, the final in the
// middle, then the mirrored SF→R32 on the right.
const COL = {
  left: { R32: 0, R16: 1, QF: 2, SF: 3 },
  center: 4,
  right: { SF: 5, QF: 6, R16: 7, R32: 8 },
} as const;

// One inner stride (`--step`) between consecutive columns. The R32→R16 step is
// at least BASE (so the packed R32 never overlaps R16) but grows with the stride
// once the widget is wide enough, keeping the spacing even across the bracket.
const STEP = VAR.step;
const BASE = `(${VAR.card} + ${VAR.lane})`;
const R32_STEP = `max(${BASE}, ${STEP})`;

/** Left edge of a column, as a CSS length. Columns 1–7 advance by one inner
 *  step each; the two R32 columns sit one R32 step out past their R16 neighbour. */
function colX(col: number): string {
  if (col === 0) return "0px";
  if (col === 8) return `calc(2 * ${R32_STEP} + 6 * ${STEP})`;
  return `calc(${R32_STEP} + ${col - 1} * ${STEP})`;
}

const LEFT_ROOT = 101;
const RIGHT_ROOT = 102;
const FINAL = 104;
const THIRD = 103;

// Where the final and third-place cards float vertically (in --leaf units), set
// into the empty middle so they clear the semis at --leaf 4.
const FINAL_LEAF = 2.3;
const THIRD_LEAF = 5.7;

// Vertical distance from a parent card's centre to each child's centre, in
// --leaf units, by the parent's depth above the leaves (R16 = 1 … SF = 3).
const CHILD_LEAF_OFFSET: Record<number, number> = { 1: 0.5, 2: 1, 3: 2 };

type RoundKey = "R32" | "R16" | "QF" | "SF";
const ROUND_DEPTH: Record<RoundKey, number> = { R32: 0, R16: 1, QF: 2, SF: 3 };
const CHILD_ROUND: Record<RoundKey, RoundKey | null> = {
  R32: null,
  R16: "R32",
  QF: "R16",
  SF: "QF",
};

/** Vertical centre of a card (in --leaf units) from its index within the round:
 *  each round's cards sit at the midpoint of the leaves they cover. */
function leafCenter(round: RoundKey, idx: number): number {
  if (round === "R32") return idx + 0.5;
  if (round === "R16") return 2 * idx + 1;
  if (round === "QF") return 4 * idx + 2;
  return 4; // single SF per half
}

export interface BracketSlot {
  code?: string;
  name?: string;
  probability?: number;
}

/** Looks up the predicted team for a match side. Returns `undefined` while the
 *  market is still loading so the cell can placeholder just that slot. */
export type SlotLookup = (
  match: number,
  side: "home" | "away",
) => BracketSlot | undefined;

interface BracketCardProps {
  getSlot: SlotLookup;
}

// A slot whose team is essentially certain to reach the match — highlighted.
const CERTAIN = 0.99;

/** The two feeding matches of a knockout node, or `null` for a Round-of-32 leaf
 *  (whose sides come from groups, not earlier matches). */
function childMatches(match: KnockoutMatch): [number, number] | null {
  if (match.home.kind === "match" && match.away.kind === "match")
    return [match.home.match, match.away.match];
  return null;
}

/** Each round's match numbers under a half-root, ordered top→bottom so a flat
 *  column lines up with the connectors (the order a DFS visits the leaves). */
function orderedRounds(root: number): Record<RoundKey, number[]> {
  const out: Record<RoundKey, number[]> = { R32: [], R16: [], QF: [], SF: [] };
  const visit = (n: number) => {
    const match = matchByNumber[n];
    const kids = childMatches(match);
    if (kids) {
      visit(kids[0]);
      visit(kids[1]);
    }
    out[match.round as RoundKey]?.push(n);
  };
  visit(root);
  return out;
}

function PctCell({
  slot,
  lead,
  certain,
}: {
  slot: BracketSlot | undefined;
  lead: boolean;
  certain?: boolean;
}) {
  const p = slot?.probability;
  return (
    <span
      className={cn(
        "flex items-center justify-center text-[8px] leading-none tabular-nums sm:text-[10px] lg:text-[11px]",
        certain
          ? "font-semibold text-pick"
          : lead
            ? "font-semibold text-foreground"
            : "text-muted-foreground",
      )}
    >
      {/* a confirmed team reads as a check; it says "through" in less width */}
      {certain ? (
        <Check
          className="size-2 sm:size-2.5"
          strokeWidth={3}
          aria-label="through"
        />
      ) : (
        // number full size, percent sign a touch smaller to save width
        <span>
          {p === undefined ? "··" : Math.round(p * 100)}
          {p !== undefined && <span className="text-[0.8em]">%</span>}
        </span>
      )}
    </span>
  );
}

function FlagCell({
  slot,
  dim,
}: {
  slot: BracketSlot | undefined;
  dim: boolean;
}) {
  return (
    <Flag
      code={slot?.code}
      size={VAR.flag}
      className={cn("block rounded-[1px] ring-0", dim && "opacity-55")}
    />
  );
}

/** One match as a four-quadrant card: the two flags stacked on the outer side,
 *  their probabilities on the (wider) inner side. Opaque so the connectors that
 *  pass behind it (the columns nest) stay hidden until they clear the edge.
 *  Driven by the `--flag`/`--pct` CSS vars, so any container can size it. */
export function MatchCard({
  number,
  getSlot,
  mirror,
}: {
  number: number;
  getSlot: SlotLookup;
  mirror?: boolean;
}) {
  const home = getSlot(number, "home");
  const away = getSlot(number, "away");
  const homeLeads = (home?.probability ?? 0) >= (away?.probability ?? 0);
  const homeCertain = (home?.probability ?? 0) > CERTAIN;
  const awayCertain = (away?.probability ?? 0) > CERTAIN;

  const flagHome = <FlagCell slot={home} dim={!homeLeads && !homeCertain} />;
  const pctHome = (
    <PctCell slot={home} lead={homeLeads} certain={homeCertain} />
  );
  const flagAway = <FlagCell slot={away} dim={homeLeads && !awayCertain} />;
  const pctAway = (
    <PctCell slot={away} lead={!homeLeads} certain={awayCertain} />
  );

  return (
    <div className="overflow-hidden rounded-[3px] border border-surface-border bg-surface-2 p-0.5">
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: mirror
            ? `${VAR.pct} ${VAR.flag}`
            : `${VAR.flag} ${VAR.pct}`,
        }}
      >
        {mirror ? (
          <>
            {pctHome}
            {flagHome}
            {pctAway}
            {flagAway}
          </>
        ) : (
          <>
            {flagHome}
            {pctHome}
            {flagAway}
            {pctAway}
          </>
        )}
      </div>
    </div>
  );
}

/** A card pinned by absolute position: centred on (`x`, `leaf`) in the shared
 *  coordinate space, above the connectors so it masks the ones behind it. */
function PositionedCard({
  number,
  x,
  leaf,
  getSlot,
  mirror,
}: {
  number: number;
  x: string;
  leaf: number;
  getSlot: SlotLookup;
  mirror?: boolean;
}) {
  return (
    <div
      className="absolute z-10 -translate-y-1/2"
      style={{ left: x, top: `calc(${leaf} * ${VAR.leaf})`, width: VAR.card }}
    >
      <MatchCard number={number} getSlot={getSlot} mirror={mirror} />
    </div>
  );
}

/** Connector from a parent card to its two children: a vertical bus spanning
 *  both child centres, plus a horizontal arm at the parent's centre line. Drawn
 *  behind the cards (z-0), so each child only shows the bus past its edge. With
 *  `fromBottom` the bus sits at the child's centre, so the line leaves the lower
 *  edge of the upper child (and the upper edge of the lower one) instead of
 *  running down its inner side. */
function Wire({
  parentX,
  childX,
  parentLeaf,
  off,
  mirror,
  fromBottom,
}: {
  parentX: string;
  childX: string;
  parentLeaf: number;
  off: number;
  mirror?: boolean;
  fromBottom?: boolean;
}) {
  const armY = `calc(${parentLeaf} * ${VAR.leaf})`;
  const childInner = mirror ? childX : `calc(${childX} + ${VAR.card})`;
  const parentOuter = mirror ? `calc(${parentX} + ${VAR.card})` : parentX;
  // Side connectors centre the bus in the gap (with short stubs from each
  // child's edge); bottom connectors run it through the child's centre.
  const busX = fromBottom
    ? `calc(${childX} + ${VAR.card} / 2)`
    : `calc((${childInner} + ${parentOuter}) / 2)`;
  const hLine = (from: string, to: string, top: string) => (
    <span
      aria-hidden
      className="absolute z-0 h-px bg-border-strong"
      style={{
        left: `min(${from}, ${to})`,
        top,
        width: `calc(max(${from}, ${to}) - min(${from}, ${to}))`,
      }}
    />
  );
  return (
    <>
      <span
        aria-hidden
        className="absolute z-0 w-px bg-border-strong"
        style={{
          left: busX,
          top: `calc(${armY} - ${off} * ${VAR.leaf})`,
          height: `calc(2 * ${off} * ${VAR.leaf})`,
        }}
      />
      {hLine(busX, parentOuter, armY)}
      {!fromBottom && (
        <>
          {hLine(childInner, busX, `calc(${armY} - ${off} * ${VAR.leaf})`)}
          {hLine(childInner, busX, `calc(${armY} + ${off} * ${VAR.leaf})`)}
        </>
      )}
    </>
  );
}

function CenterLabel({
  text,
  trophy,
  className,
}: {
  text: string;
  trophy?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "absolute left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap text-[9px] font-medium tracking-widest text-muted-foreground/70 uppercase",
        className,
      )}
    >
      {trophy && <Trophy className="size-3 text-pick" />}
      {text}
    </span>
  );
}

/** The final / third-place card, centred on (`x`, `leaf`) with a label above or
 *  below it. Opaque, so the vertical center line meets its edge cleanly. */
function CenterNode({
  number,
  x,
  leaf,
  label,
  trophy,
  labelBelow,
  getSlot,
}: {
  number: number;
  x: string;
  leaf: number;
  label: string;
  trophy?: boolean;
  labelBelow?: boolean;
  getSlot: SlotLookup;
}) {
  return (
    <div
      className="absolute z-10 -translate-y-1/2"
      style={{ left: x, top: `calc(${leaf} * ${VAR.leaf})`, width: VAR.card }}
    >
      <div className="relative">
        <CenterLabel
          text={label}
          trophy={trophy}
          className={labelBelow ? "top-full mt-1" : "bottom-full mb-1"}
        />
        <MatchCard number={number} getSlot={getSlot} />
      </div>
    </div>
  );
}

/** The center cross: the horizontal line joining the two semis at --leaf 4, and
 *  the vertical line running up to the final and down to the third-place card. */
function CenterCross({ getSlot }: { getSlot: SlotLookup }) {
  const centerX = `calc(${colX(COL.center)} + ${VAR.card} / 2)`;
  const leftInner = `calc(${colX(COL.left.SF)} + ${VAR.card})`;
  const rightInner = colX(COL.right.SF);
  return (
    <>
      <span
        aria-hidden
        className="absolute z-0 h-px bg-border-strong"
        style={{
          left: leftInner,
          top: `calc(4 * ${VAR.leaf})`,
          width: `calc(${rightInner} - ${leftInner})`,
        }}
      />
      <span
        aria-hidden
        className="absolute z-0 w-px bg-border-strong"
        style={{
          left: centerX,
          top: `calc(${FINAL_LEAF} * ${VAR.leaf})`,
          height: `calc(${THIRD_LEAF - FINAL_LEAF} * ${VAR.leaf})`,
        }}
      />
      <CenterNode
        number={FINAL}
        x={colX(COL.center)}
        leaf={FINAL_LEAF}
        label="Final"
        trophy
        getSlot={getSlot}
      />
      <CenterNode
        number={THIRD}
        x={colX(COL.center)}
        leaf={THIRD_LEAF}
        label="3rd"
        labelBelow
        getSlot={getSlot}
      />
    </>
  );
}

const ROUND_LABELS: { round: RoundKey; col: number }[] = [
  { round: "R32", col: COL.left.R32 },
  { round: "R16", col: COL.left.R16 },
  { round: "QF", col: COL.left.QF },
  { round: "SF", col: COL.left.SF },
  { round: "SF", col: COL.right.SF },
  { round: "QF", col: COL.right.QF },
  { round: "R16", col: COL.right.R16 },
  { round: "R32", col: COL.right.R32 },
];

function RoundLabels() {
  return (
    <div className="relative h-3 w-full">
      {ROUND_LABELS.map(({ round, col }) => (
        <span
          key={col}
          className="absolute text-center text-[9px] font-medium tracking-wide text-muted-foreground/55 uppercase"
          style={{ left: colX(col), width: VAR.card }}
        >
          {round}
        </span>
      ))}
    </div>
  );
}

const HELP_TEXT = "Each number is a team's chance to reach that match.";

/** The header info affordance. Native `title` only surfaces on hover, so on
 *  touch we toggle a small popover on tap; a transparent backdrop dismisses it. */
function BracketHelp() {
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
          <div className="absolute top-full right-0 z-20 mt-1.5 w-56 rounded-md border border-surface-border bg-surface-2 p-2 text-[10px] leading-relaxed text-muted-foreground shadow-lg">
            {HELP_TEXT}
          </div>
        </>
      )}
    </div>
  );
}

/** One half's cards plus the connectors from each non-leaf card to its two
 *  children, all in the shared absolute coordinate space. */
function half(
  rounds: Record<RoundKey, number[]>,
  side: "left" | "right",
  getSlot: SlotLookup,
) {
  const mirror = side === "right";
  const colOf = (round: RoundKey) =>
    side === "left" ? COL.left[round] : COL.right[round];

  const cards = (Object.keys(rounds) as RoundKey[]).flatMap((round) =>
    rounds[round].map((n, idx) => (
      <PositionedCard
        key={n}
        number={n}
        x={colX(colOf(round))}
        leaf={leafCenter(round, idx)}
        getSlot={getSlot}
        mirror={mirror}
      />
    )),
  );

  const wires = (["R16", "QF", "SF"] as RoundKey[]).flatMap((round) => {
    const childRound = CHILD_ROUND[round];
    if (!childRound) return [];
    const childX = colX(colOf(childRound));
    const off = CHILD_LEAF_OFFSET[ROUND_DEPTH[round]];
    return rounds[round].map((n, idx) => (
      <Wire
        key={`w${n}`}
        parentX={colX(colOf(round))}
        childX={childX}
        parentLeaf={leafCenter(round, idx)}
        off={off}
        mirror={mirror}
        // children that are R16 / QF (parent QF / SF) drop from the box bottom
        fromBottom={ROUND_DEPTH[round] >= 2}
      />
    ));
  });

  return [...wires, ...cards];
}

/** The knockout bracket as predicted. Each match is a four-quadrant card; the
 *  inner rounds nest into the empty top/bottom of the previous column so the
 *  whole bracket stays compact, with connectors emerging from the card edges. */
export function BracketCard({ getSlot }: BracketCardProps) {
  const left = orderedRounds(LEFT_ROOT);
  const right = orderedRounds(RIGHT_ROOT);

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center gap-1.5 border-b border-surface-divider px-3">
        <span className="shrink-0 text-[11px] font-medium tracking-wide text-foreground/70">
          Prediction bracket
        </span>
        <span className="min-w-0 truncate text-[10px] text-muted-foreground/55">
          · chances to reach each stage
        </span>
        <BracketHelp />
      </div>
      <div className="overflow-x-auto px-2 py-3 [--card:calc(var(--flag)+var(--pct)+8px)] [--flag:14px] [--lane:6px] [--leaf:40px] [--pct:18px] sm:[--flag:17px] sm:[--lane:9px] sm:[--leaf:52px] sm:[--pct:22px] lg:[--flag:20px] lg:[--lane:12px] lg:[--leaf:60px] lg:[--pct:26px]">
        <div
          className="w-full"
          style={{ "--step": STEP_VALUE } as CSSProperties}
        >
          <RoundLabels />
          <div
            className="relative mt-1.5 w-full"
            style={{ height: `calc(${VAR.leaf} * 8)` }}
          >
            {half(left, "left", getSlot)}
            {half(right, "right", getSlot)}
            <CenterCross getSlot={getSlot} />
          </div>
        </div>
      </div>
    </div>
  );
}

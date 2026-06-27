"use client";

import { cn } from "cnfast";
import { Info, Trophy } from "lucide-react";
import { useState } from "react";

import { Flag } from "@/components/flags";
import {
  type KnockoutMatch,
  matchByNumber,
  type Round,
} from "@/lib/tournament";

// Geometry is driven by CSS variables set on the root (see BracketCard), so the
// whole bracket scales with the breakpoint. --flag is the flag column width,
// --pct the (wider) probability column, --leaf the vertical slot a Round-of-32
// match reserves. Connectors flex to fill the rest of the widget width.
const VAR = {
  flag: "var(--flag)",
  pct: "var(--pct)",
  leaf: "var(--leaf)",
};

const LEFT_ROOT = 101;
const RIGHT_ROOT = 102;
const FINAL = 104;
const THIRD = 103;

// Round labels per column, left to right: the left half (R32→SF), then the
// mirrored right half (SF→R32). The center holds the final/third cross instead
// of a column, so it has no label.
const COLUMN_LABELS = ["R32", "R16", "QF", "SF", "SF", "QF", "R16", "R32"];

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
function orderedRounds(root: number): Record<string, number[]> {
  const out: Record<string, number[]> = { R32: [], R16: [], QF: [], SF: [] };
  const visit = (n: number) => {
    const match = matchByNumber[n];
    const kids = childMatches(match);
    if (kids) {
      visit(kids[0]);
      visit(kids[1]);
    }
    out[match.round]?.push(n);
  };
  visit(root);
  return out;
}

function PctCell({
  slot,
  lead,
  certain,
  mirror,
}: {
  slot: BracketSlot | undefined;
  lead: boolean;
  certain?: boolean;
  mirror?: boolean;
}) {
  const p = slot?.probability;
  return (
    <span
      className={cn(
        "flex items-center text-[8px] leading-none tabular-nums sm:text-[10px] lg:text-[11px]",
        // aligned against the flag, not centered
        mirror ? "justify-end" : "justify-start",
        certain
          ? "font-semibold text-pick"
          : lead
            ? "font-semibold text-foreground"
            : "text-muted-foreground",
      )}
    >
      {/* number full size, percent sign a touch smaller to save width */}
      <span>
        {p === undefined ? "··" : Math.round(p * 100)}
        {p !== undefined && <span className="text-[0.8em]">%</span>}
      </span>
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

/** One match as a bordered card split into four: the two flags stacked on the
 *  outer side, their probabilities on the (wider) inner side. 2px gaps separate
 *  the quadrants; each flag rounds only the corner it shares with the card. */
function MatchCard({
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
    <PctCell
      slot={home}
      lead={homeLeads}
      certain={homeCertain}
      mirror={mirror}
    />
  );
  const flagAway = <FlagCell slot={away} dim={homeLeads && !awayCertain} />;
  const pctAway = (
    <PctCell
      slot={away}
      lead={!homeLeads}
      certain={awayCertain}
      mirror={mirror}
    />
  );

  return (
    <div className="overflow-hidden rounded-[3px] border border-surface-border bg-surface-2/40 p-0.5 sm:p-1">
      <div
        className="grid gap-0.5 sm:gap-1"
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

/** ⊢ (⊣ when mirrored) filling its slot: ticks at 25%/75% reach the two children
 *  and the 50% tick the parent. */
function Connector({ mirror }: { mirror?: boolean }) {
  const tick = "absolute h-px bg-border-strong";
  const childX = mirror ? "right-0 left-1/2" : "left-0 right-1/2";
  const nodeX = mirror ? "left-0 right-1/2" : "right-0 left-1/2";
  return (
    <div className="relative h-full w-full">
      <span className={cn(tick, childX, "top-1/4")} />
      <span className={cn(tick, childX, "top-3/4")} />
      <span className="absolute top-1/4 bottom-1/4 left-1/2 w-px bg-border-strong" />
      <span className={cn(tick, nodeX, "top-1/2")} />
    </div>
  );
}

/** A flex column of `pairs` connectors — one per parent match in the next round.
 *  Grows to share the leftover width, so the bracket fills the widget. */
function ConnectorColumn({
  pairs,
  mirror,
}: {
  pairs: number;
  mirror?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {Array.from({ length: pairs }, (_, i) => (
        <div key={i} className="flex-1">
          <Connector mirror={mirror} />
        </div>
      ))}
    </div>
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

/** A final/third card pinned at `top`, with a label above or below. The opaque
 *  backing hides the vertical line where it passes behind the card, so the line
 *  meets the card edge instead of running into the box. */
function CenterNode({
  number,
  label,
  trophy,
  labelBelow,
  top,
  getSlot,
}: {
  number: number;
  label: string;
  trophy?: boolean;
  labelBelow?: boolean;
  top: string;
  getSlot: SlotLookup;
}) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ top }}
    >
      <div className="relative rounded-sm bg-card">
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

/** The center of the bracket: a cross of lines. The horizontal line joins the
 *  two semis; the vertical line runs up to the final and down to the third-place
 *  play-off, which float in the otherwise-empty middle so they cost no width. */
function CenterCross({ getSlot }: { getSlot: SlotLookup }) {
  return (
    <div className="relative flex-[2.6] self-stretch">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
      {/* spans the two card centers; the opaque cards clip it to the gap */}
      <span className="absolute top-[27%] bottom-[27%] left-1/2 w-px bg-border-strong" />
      <CenterNode
        number={FINAL}
        label="Final"
        trophy
        top="27%"
        getSlot={getSlot}
      />
      <CenterNode
        number={THIRD}
        label="3rd"
        labelBelow
        top="73%"
        getSlot={getSlot}
      />
    </div>
  );
}

function RoundColumn({
  matches,
  getSlot,
  mirror,
}: {
  matches: number[];
  getSlot: SlotLookup;
  mirror?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col justify-around">
      {matches.map((n) => (
        <MatchCard key={n} number={n} getSlot={getSlot} mirror={mirror} />
      ))}
    </div>
  );
}

function RoundLabels() {
  const cells = COLUMN_LABELS.flatMap((label, i) => {
    // the gap between the two SF labels is the center cross — keep it as wide
    // as the CenterCross so the labels stay over their columns.
    const spacer =
      i > 0
        ? [<div key={`s${i}`} className={i === 4 ? "flex-[2.6]" : "flex-1"} />]
        : [];
    return [
      ...spacer,
      <span
        key={`l${i}`}
        className="shrink-0 text-center text-[9px] font-medium tracking-wide text-muted-foreground/55 uppercase"
        style={{ width: `calc(${VAR.flag} + ${VAR.pct} + 2px)` }}
      >
        {label}
      </span>,
    ];
  });
  return <div className="flex w-full">{cells}</div>;
}

const HELP_TEXT =
  "Each number is a team's chance to reach that match — not to win it. Green marks teams effectively through (≥99%).";

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

/** The knockout bracket as predicted: each match is a four-quadrant card (flags
 *  stacked on the outer side, probabilities inner). The two halves and the
 *  center final span the full widget width, the connectors stretching to fill. */
export function BracketCard({ getSlot }: BracketCardProps) {
  const left = orderedRounds(LEFT_ROOT);
  const right = orderedRounds(RIGHT_ROOT);
  const col = (matches: number[], mirror?: boolean) => (
    <RoundColumn matches={matches} getSlot={getSlot} mirror={mirror} />
  );

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
      <div className="overflow-x-auto px-2 py-3 [--flag:13px] [--leaf:38px] [--pct:19px] sm:[--flag:17px] sm:[--leaf:52px] sm:[--pct:24px] lg:[--flag:20px] lg:[--leaf:60px] lg:[--pct:28px]">
        <RoundLabels />
        <div
          className="mt-1.5 flex w-full items-stretch"
          style={{ height: `calc(${VAR.leaf} * 8)` }}
        >
          {col(left.R32)}
          <ConnectorColumn pairs={4} />
          {col(left.R16)}
          <ConnectorColumn pairs={2} />
          {col(left.QF)}
          <ConnectorColumn pairs={1} />
          {col(left.SF)}
          <CenterCross getSlot={getSlot} />
          {col(right.SF, true)}
          <ConnectorColumn pairs={1} mirror />
          {col(right.QF, true)}
          <ConnectorColumn pairs={2} mirror />
          {col(right.R16, true)}
          <ConnectorColumn pairs={4} mirror />
          {col(right.R32, true)}
        </div>
      </div>
    </div>
  );
}

import { cn } from "cnfast";
import { Trophy } from "lucide-react";

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
  /** Predicted champion code — highlighted along its path. `undefined` until the
   *  bracket simulation resolves. */
  championCode?: string;
}

function formatPct(p?: number): string {
  return p === undefined ? "··" : `${Math.round(p * 100)}%`;
}

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
  champion,
  mirror,
}: {
  slot: BracketSlot | undefined;
  lead: boolean;
  champion?: boolean;
  mirror?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center text-[9px] leading-none tabular-nums sm:text-[11px] lg:text-[12px]",
        // hairline between the flag (outer) and the probability (inner)
        mirror
          ? "border-r border-surface-border"
          : "border-l border-surface-border",
        champion
          ? "font-semibold text-pick"
          : lead
            ? "font-semibold text-foreground"
            : "text-muted-foreground",
      )}
    >
      {formatPct(slot?.probability)}
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
      className={cn("block rounded-none ring-0", dim && "opacity-55")}
    />
  );
}

/** One match as a bordered card split into four: the two flags stacked flush on
 *  the outer side, their probabilities on the (wider) inner side. */
function MatchCard({
  number,
  getSlot,
  championCode,
  mirror,
}: {
  number: number;
  getSlot: SlotLookup;
  championCode?: string;
  mirror?: boolean;
}) {
  const home = getSlot(number, "home");
  const away = getSlot(number, "away");
  const homeLeads = (home?.probability ?? 0) >= (away?.probability ?? 0);
  const isChampion = (slot?: BracketSlot) =>
    championCode != null && slot?.code === championCode;

  const flagHome = (
    <FlagCell slot={home} dim={!homeLeads && !isChampion(home)} />
  );
  const pctHome = (
    <PctCell
      slot={home}
      lead={homeLeads}
      champion={isChampion(home)}
      mirror={mirror}
    />
  );
  const flagAway = (
    <FlagCell slot={away} dim={homeLeads && !isChampion(away)} />
  );
  const pctAway = (
    <PctCell
      slot={away}
      lead={!homeLeads}
      champion={isChampion(away)}
      mirror={mirror}
    />
  );

  return (
    <div
      className="grid overflow-hidden rounded-md border border-surface-border bg-surface-2/40"
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

function CenterLabel({ text, trophy }: { text: string; trophy?: boolean }) {
  return (
    <span className="flex items-center gap-1 text-[9px] font-medium tracking-widest text-muted-foreground/70 uppercase">
      {trophy && <Trophy className="size-3 text-pick" />}
      {text}
    </span>
  );
}

/** The center of the bracket: a cross of lines. The horizontal line joins the
 *  two semis; the vertical line runs up to the final and down to the third-place
 *  play-off, which float in the otherwise-empty middle so they cost no width. */
function CenterCross({
  getSlot,
  championCode,
}: {
  getSlot: SlotLookup;
  championCode?: string;
}) {
  return (
    <div className="relative flex-1 self-stretch">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
      <span className="absolute top-[31%] bottom-[31%] left-1/2 w-px bg-border-strong" />
      <div className="absolute top-[26%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
        <CenterLabel text="Final" trophy />
        <MatchCard
          number={FINAL}
          getSlot={getSlot}
          championCode={championCode}
        />
      </div>
      <div className="absolute top-[74%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
        <MatchCard
          number={THIRD}
          getSlot={getSlot}
          championCode={championCode}
        />
        <CenterLabel text="3rd" />
      </div>
    </div>
  );
}

function RoundColumn({
  matches,
  getSlot,
  championCode,
  mirror,
}: {
  matches: number[];
  getSlot: SlotLookup;
  championCode?: string;
  mirror?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col justify-around">
      {matches.map((n) => (
        <MatchCard
          key={n}
          number={n}
          getSlot={getSlot}
          championCode={championCode}
          mirror={mirror}
        />
      ))}
    </div>
  );
}

function RoundLabels() {
  const cells = COLUMN_LABELS.flatMap((label, i) => {
    const spacer = i > 0 ? [<div key={`s${i}`} className="flex-1" />] : [];
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

/** The knockout bracket as predicted: each match is a four-quadrant card (flags
 *  stacked on the outer side, probabilities inner). The two halves and the
 *  center final span the full widget width, the connectors stretching to fill. */
export function BracketCard({ getSlot, championCode }: BracketCardProps) {
  const left = orderedRounds(LEFT_ROOT);
  const right = orderedRounds(RIGHT_ROOT);
  const col = (matches: number[], mirror?: boolean) => (
    <RoundColumn
      matches={matches}
      getSlot={getSlot}
      championCode={championCode}
      mirror={mirror}
    />
  );

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center border-b border-surface-divider px-3 text-[11px] font-medium tracking-wide text-foreground/70">
        Bracket
      </div>
      <div className="overflow-x-auto px-2 py-3 [--flag:13px] [--leaf:30px] [--pct:26px] sm:[--flag:17px] sm:[--leaf:36px] sm:[--pct:36px] lg:[--flag:20px] lg:[--leaf:42px] lg:[--pct:44px]">
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
          <CenterCross getSlot={getSlot} championCode={championCode} />
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

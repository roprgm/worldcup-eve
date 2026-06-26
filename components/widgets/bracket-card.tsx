import { cn } from "cnfast";
import { Trophy } from "lucide-react";

import { Flag } from "@/components/flags";
import {
  type KnockoutMatch,
  matchByNumber,
  type Round,
} from "@/lib/tournament";

// Geometry is driven by CSS variables set on the root (see BracketCard), so the
// whole bracket scales with the breakpoint: compact on a phone, spread out on
// the web. --chip is a column width, --conn a connector length, --leaf the
// vertical slot a Round-of-32 match reserves, --final the width of the final box.
const VAR = {
  chip: "var(--chip)",
  conn: "var(--conn)",
  leaf: "var(--leaf)",
  final: "var(--final)",
};

// The two semi-final roots and the final. The halves hang off the semis (the
// right one mirrored so they meet in the middle); the final sits between them on
// the web and drops below on a phone.
const LEFT_ROOT = 101;
const RIGHT_ROOT = 102;
const FINAL = 104;

const ROUND_LABELS: Record<Round, string> = {
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  TP: "3rd",
  FINAL: "Final",
};

// Outer→inner round order of one half, left column first.
const HALF_ROUNDS: Round[] = ["R32", "R16", "QF", "SF"];

export interface BracketSlot {
  code?: string;
  name?: string;
  probability?: number;
}

/** Looks up the predicted team for a match side. Returns `undefined` while the
 *  market is still loading so the chip can placeholder just that slot. */
export type SlotLookup = (
  match: number,
  side: "home" | "away",
) => BracketSlot | undefined;

interface BracketCardProps {
  getSlot: SlotLookup;
  /** Predicted champion code — highlighted in the final. `undefined` until the
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

/** Probability over flag over code, centered — one chip wide and borderless. The
 *  connectors and spacing carry the structure the card used to. */
function SlotChip({
  slot,
  lead,
  champion,
}: {
  slot: BracketSlot | undefined;
  lead: boolean;
  champion?: boolean;
}) {
  const dim = !lead && !champion;
  return (
    <div
      className="flex flex-col items-center gap-px leading-none"
      style={{ width: VAR.chip }}
      title={slot?.name}
    >
      <span
        className={cn(
          "text-[9px] tabular-nums",
          champion
            ? "font-semibold text-pick"
            : dim
              ? "text-muted-foreground/55"
              : "text-foreground/80",
        )}
      >
        {formatPct(slot?.probability)}
      </span>
      <Flag code={slot?.code} size={18} className={cn(dim && "opacity-70")} />
      <span
        className={cn(
          "text-[9px] font-semibold tracking-tight",
          champion
            ? "text-pick"
            : dim
              ? "text-muted-foreground"
              : "text-foreground",
        )}
      >
        {slot?.code ?? "—"}
      </span>
    </div>
  );
}

function MatchNode({
  number,
  getSlot,
  championCode,
}: {
  number: number;
  getSlot: SlotLookup;
  championCode?: string;
}) {
  const home = getSlot(number, "home");
  const away = getSlot(number, "away");
  const homeLeads = (home?.probability ?? 0) >= (away?.probability ?? 0);
  const isChampion = (slot?: BracketSlot) =>
    championCode != null && slot?.code === championCode;

  return (
    <div className="flex flex-col items-center gap-1">
      <SlotChip slot={home} lead={homeLeads} champion={isChampion(home)} />
      <SlotChip slot={away} lead={!homeLeads} champion={isChampion(away)} />
    </div>
  );
}

/** ⊢ (⊣ when mirrored) joining a node's two children to the node. Ticks at
 *  25%/75% are the children's centers; the 50% tick points at the node. */
function Connector({ mirror }: { mirror?: boolean }) {
  const tick = "absolute h-px bg-border-strong";
  const childX = mirror ? "right-0 left-1/2" : "left-0 right-1/2";
  const nodeX = mirror ? "left-0 right-1/2" : "right-0 left-1/2";
  return (
    <div style={{ width: VAR.conn }} className="relative shrink-0 self-stretch">
      <span className={cn(tick, childX, "top-1/4")} />
      <span className={cn(tick, childX, "top-3/4")} />
      <span className="absolute top-1/4 bottom-1/4 left-1/2 w-px bg-border-strong" />
      <span className={cn(tick, nodeX, "top-1/2")} />
    </div>
  );
}

/** One node and its whole subtree. Earlier rounds sit on the outer side (left,
 *  or right when mirrored), recursing until a Round-of-32 leaf. */
function BracketTree({
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
  const kids = childMatches(matchByNumber[number]);
  const node = (
    <MatchNode number={number} getSlot={getSlot} championCode={championCode} />
  );

  if (!kids) {
    return (
      <div style={{ height: VAR.leaf }} className="flex items-center">
        {node}
      </div>
    );
  }

  const children = (
    <div className="flex flex-col">
      {kids.map((kid) => (
        <div key={kid} className="flex flex-1 items-center">
          <BracketTree
            number={kid}
            getSlot={getSlot}
            championCode={championCode}
            mirror={mirror}
          />
        </div>
      ))}
    </div>
  );
  const nodeWrap = <div className="flex items-center">{node}</div>;

  return (
    <div className="flex items-stretch">
      {mirror ? (
        <>
          {nodeWrap}
          <Connector mirror />
          {children}
        </>
      ) : (
        <>
          {children}
          <Connector />
          {nodeWrap}
        </>
      )}
    </div>
  );
}

function RoundLabels({ mirror }: { mirror?: boolean }) {
  const rounds = mirror ? [...HALF_ROUNDS].reverse() : HALF_ROUNDS;
  return (
    <div className="flex" style={{ gap: VAR.conn }}>
      {rounds.map((round) => (
        <span
          key={round}
          style={{ width: VAR.chip }}
          className="text-center text-[9px] font-medium tracking-wide text-muted-foreground/55 uppercase"
        >
          {ROUND_LABELS[round]}
        </span>
      ))}
    </div>
  );
}

function FinalSlot({
  slot,
  championCode,
}: {
  slot: BracketSlot | undefined;
  championCode?: string;
}) {
  const champion = championCode != null && slot?.code === championCode;
  return (
    <div
      className="flex flex-col items-center gap-1 leading-none"
      title={slot?.name}
    >
      <span
        className={cn(
          "flex items-center gap-1 text-[11px] tabular-nums",
          champion ? "font-semibold text-pick" : "text-muted-foreground",
        )}
      >
        {champion && <Trophy className="size-3 shrink-0" />}
        {formatPct(slot?.probability)}
      </span>
      <Flag code={slot?.code} size={26} />
      <span
        className={cn(
          "text-[12px] font-semibold tracking-wide",
          champion ? "text-pick" : "text-foreground",
        )}
      >
        {slot?.code ?? "—"}
      </span>
    </div>
  );
}

/** The champion box: the two finalists with the predicted winner highlighted.
 *  Fixed width (--final) so the label strip can reserve the same center gap. */
function FinalBox({
  getSlot,
  championCode,
}: {
  getSlot: SlotLookup;
  championCode?: string;
}) {
  return (
    <div
      style={{ width: VAR.final }}
      className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-pick/40 bg-surface-2/40 px-4 py-3 ring-1 ring-pick/10"
    >
      <span className="text-[9px] font-medium tracking-widest text-muted-foreground uppercase">
        Final
      </span>
      <div className="flex items-start justify-center gap-5">
        <FinalSlot slot={getSlot(FINAL, "home")} championCode={championCode} />
        <FinalSlot slot={getSlot(FINAL, "away")} championCode={championCode} />
      </div>
    </div>
  );
}

/** Final in the center column, joined to both semis by a connector. Web only —
 *  it needs the horizontal room a phone doesn't have. */
function CenterFinal({
  getSlot,
  championCode,
}: {
  getSlot: SlotLookup;
  championCode?: string;
}) {
  return (
    <div className="hidden items-center lg:flex">
      <span className="h-px bg-border-strong" style={{ width: VAR.conn }} />
      <FinalBox getSlot={getSlot} championCode={championCode} />
      <span className="h-px bg-border-strong" style={{ width: VAR.conn }} />
    </div>
  );
}

/** Final stacked below the bracket — the phone/tablet layout. */
function FinalBelow({
  getSlot,
  championCode,
}: {
  getSlot: SlotLookup;
  championCode?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 pt-2 lg:hidden">
      <span className="h-4 w-px bg-border-strong" />
      <FinalBox getSlot={getSlot} championCode={championCode} />
    </div>
  );
}

/** The knockout bracket as predicted: each slot's most-likely team shown as a
 *  borderless probability-over-flag-over-code chip. Both halves sit side by side
 *  (the right one mirrored); the final lands between them on the web and drops
 *  below on a phone. Geometry scales with the breakpoint via CSS variables. */
export function BracketCard({ getSlot, championCode }: BracketCardProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center border-b border-surface-divider px-3 text-[11px] font-medium tracking-wide text-foreground/70">
        Bracket
      </div>
      <div className="overflow-x-auto px-3 py-4 [--chip:30px] [--conn:12px] [--final:180px] [--leaf:92px] sm:[--chip:36px] sm:[--conn:26px] sm:[--leaf:100px] lg:[--chip:42px] lg:[--conn:40px] lg:[--final:168px] lg:[--leaf:104px]">
        <div className="mx-auto flex w-fit flex-col items-center">
          {/* Labels strip above the bracket, aligned to the columns. On the web
              the center gap matches the final box so the right labels line up. */}
          <div className="flex gap-[var(--conn)] lg:gap-0">
            <RoundLabels />
            <div
              className="hidden shrink-0 lg:block"
              style={{ width: "calc(var(--final) + var(--conn) * 2)" }}
            />
            <RoundLabels mirror />
          </div>

          <div className="mt-1.5 flex items-center gap-[var(--conn)] lg:gap-0">
            <BracketTree
              number={LEFT_ROOT}
              getSlot={getSlot}
              championCode={championCode}
            />
            <CenterFinal getSlot={getSlot} championCode={championCode} />
            <BracketTree
              number={RIGHT_ROOT}
              getSlot={getSlot}
              championCode={championCode}
              mirror
            />
          </div>
        </div>

        <FinalBelow getSlot={getSlot} championCode={championCode} />
      </div>
    </div>
  );
}

import { cn } from "cnfast";
import { Trophy } from "lucide-react";

import { Flag } from "@/components/flags";
import {
  type KnockoutMatch,
  matchByNumber,
  type Round,
} from "@/lib/tournament";

// Geometry of one half-bracket. Each round is a CHIP_W column joined by a CONN_W
// connector; a leaf (Round-of-32 match) reserves LEAF_H so adjacent matches read
// as pairs. Tuned so both halves sit side by side within a phone width.
const CHIP_W = 30;
const CONN_W = 12;
const LEAF_H = 84;

// The two semi-final roots and the final. The halves hang off the semis (the
// right one mirrored so they meet in the middle); the final drops below both.
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
      style={{ width: CHIP_W }}
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
      <Flag code={slot?.code} size={16} className={cn(dim && "opacity-70")} />
      <span
        className={cn(
          "text-[8px] font-semibold tracking-tight",
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
    <div style={{ width: CONN_W }} className="relative shrink-0 self-stretch">
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
      <div style={{ height: LEAF_H }} className="flex items-center">
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
    <div className="flex" style={{ gap: CONN_W }}>
      {rounds.map((round) => (
        <span
          key={round}
          style={{ width: CHIP_W }}
          className="text-center text-[9px] font-medium tracking-wide text-muted-foreground/55 uppercase"
        >
          {ROUND_LABELS[round]}
        </span>
      ))}
    </div>
  );
}

function Half({
  root,
  getSlot,
  championCode,
  mirror,
}: {
  root: number;
  getSlot: SlotLookup;
  championCode?: string;
  mirror?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <RoundLabels mirror={mirror} />
      <BracketTree
        number={root}
        getSlot={getSlot}
        championCode={championCode}
        mirror={mirror}
      />
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
      <Flag code={slot?.code} size={24} />
      <span
        className={cn(
          "text-[11px] font-semibold tracking-wide",
          champion ? "text-pick" : "text-foreground",
        )}
      >
        {slot?.code ?? "—"}
      </span>
    </div>
  );
}

function FinalCard({
  getSlot,
  championCode,
}: {
  getSlot: SlotLookup;
  championCode?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <span className="h-4 w-px bg-border-strong" />
      <div className="flex flex-col items-center gap-2 rounded-xl border border-pick/40 bg-card px-5 py-2.5 ring-1 ring-pick/10">
        <span className="text-[9px] font-medium tracking-widest text-muted-foreground uppercase">
          Final
        </span>
        <div className="flex items-start justify-center gap-6">
          <FinalSlot
            slot={getSlot(FINAL, "home")}
            championCode={championCode}
          />
          <FinalSlot
            slot={getSlot(FINAL, "away")}
            championCode={championCode}
          />
        </div>
      </div>
    </div>
  );
}

/** The knockout bracket as predicted: each slot's most-likely team shown as a
 *  borderless probability-over-flag-over-code chip. Both halves sit side by side
 *  (the right one mirrored), and the final drops below to keep it all within a
 *  phone width. */
export function BracketCard({ getSlot, championCode }: BracketCardProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center border-b border-surface-divider px-3 text-[11px] font-medium tracking-wide text-foreground/70">
        Bracket
      </div>
      <div className="overflow-x-auto px-3 py-3">
        <div className="mx-auto flex w-fit justify-center gap-2 sm:gap-4">
          <Half
            root={LEFT_ROOT}
            getSlot={getSlot}
            championCode={championCode}
          />
          <Half
            root={RIGHT_ROOT}
            getSlot={getSlot}
            championCode={championCode}
            mirror
          />
        </div>
        <FinalCard getSlot={getSlot} championCode={championCode} />
      </div>
    </div>
  );
}

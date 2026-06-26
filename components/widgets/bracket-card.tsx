import { cn } from "cnfast";

import { Flag } from "@/components/flags";
import {
  type KnockoutMatch,
  matchByNumber,
  type Round,
} from "@/lib/tournament";

// Geometry is driven by CSS variables set on the root (see BracketCard), so the
// whole bracket scales with the breakpoint: dense on a phone, larger on the web.
// --chip is a column width, --conn a connector length, --leaf the vertical slot
// a Round-of-32 match reserves, --flag the flag width.
const VAR = {
  chip: "var(--chip)",
  conn: "var(--conn)",
  leaf: "var(--leaf)",
  flag: "var(--flag)",
  link: "var(--link)",
};

// The two semi-final roots and the final. The halves hang off the semis (the
// right one mirrored), with the final dropped into the center between them.
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

/** A team on one line: flag on the outer edge, probability toward the center.
 *  No country code — the flag carries the identity (full name on hover). */
function SlotRow({
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
  const dim = !lead && !champion;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1",
        mirror && "flex-row-reverse",
      )}
      title={slot?.name}
    >
      <Flag
        code={slot?.code}
        size={VAR.flag}
        className={cn(dim && "opacity-55")}
      />
      <span
        className={cn(
          "text-[9px] tabular-nums sm:text-[11px] lg:text-[12px]",
          champion
            ? "font-semibold text-pick"
            : dim
              ? "text-muted-foreground/55"
              : "font-medium text-foreground/85",
        )}
      >
        {formatPct(slot?.probability)}
      </span>
    </div>
  );
}

function MatchNode({
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

  return (
    <div className="flex flex-col gap-0.5" style={{ width: VAR.chip }}>
      <SlotRow
        slot={home}
        lead={homeLeads}
        champion={isChampion(home)}
        mirror={mirror}
      />
      <SlotRow
        slot={away}
        lead={!homeLeads}
        champion={isChampion(away)}
        mirror={mirror}
      />
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

/** A plain horizontal line — joins each semi to the final in the center. Wider
 *  than a round connector so the final and the semis don't crowd each other. */
function Link() {
  return (
    <div style={{ width: VAR.link }} className="relative shrink-0 self-stretch">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
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
    <MatchNode
      number={number}
      getSlot={getSlot}
      championCode={championCode}
      mirror={mirror}
    />
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

/** The knockout bracket as predicted: each slot is a flag and its probability on
 *  one line, no country code. The two halves sit side by side (the right one
 *  mirrored) and the final lands in the center between them — using the vertical
 *  room that would otherwise sit empty around the semis. */
export function BracketCard({ getSlot, championCode }: BracketCardProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center border-b border-surface-divider px-3 text-[11px] font-medium tracking-wide text-foreground/70">
        Bracket
      </div>
      <div className="overflow-x-auto px-2 py-3 [--chip:28px] [--conn:7px] [--flag:12px] [--leaf:34px] [--link:20px] sm:[--chip:46px] sm:[--conn:18px] sm:[--flag:18px] sm:[--leaf:44px] sm:[--link:32px] lg:[--chip:56px] lg:[--conn:32px] lg:[--flag:22px] lg:[--leaf:52px] lg:[--link:46px]">
        <div className="mx-auto flex w-fit flex-col items-center">
          {/* Labels strip above the bracket, aligned to the columns. */}
          <div className="flex">
            <RoundLabels />
            <span
              className="flex items-center justify-center text-center text-[9px] font-medium tracking-wide text-muted-foreground/55 uppercase"
              style={{ width: "calc(var(--chip) + var(--link) * 2)" }}
            >
              Final
            </span>
            <RoundLabels mirror />
          </div>

          <div className="mt-1.5 flex items-center">
            <BracketTree
              number={LEFT_ROOT}
              getSlot={getSlot}
              championCode={championCode}
            />
            <Link />
            <MatchNode
              number={FINAL}
              getSlot={getSlot}
              championCode={championCode}
            />
            <Link />
            <BracketTree
              number={RIGHT_ROOT}
              getSlot={getSlot}
              championCode={championCode}
              mirror
            />
          </div>
        </div>
      </div>
    </div>
  );
}

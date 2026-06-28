"use client";

import { cn } from "cnfast";
import { Check, X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Flag } from "@/components/flags";
import { Skeleton } from "@/components/ui/skeleton";
import type { CellPath, PathOpponent } from "@/lib/predictions/team-path";
import type { Round } from "@/lib/tournament";

// One team's chance of reaching each knockout round, all 0–1.
export interface StageOddsRow {
  code: string;
  name?: string;
  r32: number; // P(reach Round of 32) — group stage advance
  r16: number; // P(reach Round of 16)
  qf: number; // P(reach Quarter-finals)
  sf: number; // P(reach Semi-finals)
  final: number; // P(reach Final)
  champion: number; // P(win the cup)
  // Highest stage index (see STAGES) the team has actually reached per real
  // results; -1 if none yet. Those cells show a check instead of a prediction.
  reachedIdx: number;
  // Knocked out per real results: its not-yet-reached cells are a dash, not odds.
  eliminated: boolean;
}

/** Resolve the breakdown behind a cell (team + round); `undefined` if there's
 *  nothing to explain (R32, the cup, or a team that can't get there). */
export type ResolveBreakdown = (
  code: string,
  round: Round,
) => CellPath | undefined;

// The stage columns, in bracket order. `key` indexes StageOddsRow; `round` marks
// the reach columns whose cell opens a why-this-number breakdown (R32 is the
// group result and the cup its own market, so neither carries one).
const STAGES = [
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16", round: "R16" },
  { key: "qf", label: "QF", round: "QF" },
  { key: "sf", label: "SF", round: "SF" },
  { key: "final", label: "Final", round: "FINAL" },
  { key: "champion", label: "Cup" },
] as const satisfies ReadonlyArray<{
  key: keyof StageOddsRow;
  label: string;
  round?: Round;
}>;

const ROUND_LABEL: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  TP: "Third place",
  FINAL: "Final",
};

const ROW_SKELETON = Array.from({ length: 16 }, (_, i) => `row-${i}`);

// team · six stage cells. A fixed-but-flexible team column and equal stage cells
// shared by the header and every row so the heat-map grid lines up. The cells
// widen a touch once the card has room (container query).
const STAGE_GRID =
  "grid grid-cols-[minmax(0,1fr)_repeat(6,2.4rem)] items-center gap-1 @lg:grid-cols-[minmax(0,1fr)_repeat(6,3.25rem)] @lg:gap-1.5";

// A still-alive team always keeps a sliver of a chance, so a value that rounds to
// zero floors at "<1%" rather than reading as none. Only a confirmed-out team
// shows a dash (handled in HeatCell).
function formatPct(value: number): string {
  const p = value * 100;
  if (p < 0.95) return "<1%";
  if (p < 9.95) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

const roundPct = (p: number) => `${Math.round(p * 100)}%`;

// What the table is showing, surfaced in the header. A field cut (the whole
// field, or its Top-N) toggles between the two; a fixed team list just labels how
// many it shows.
export type StageOddsHeader =
  | { toggleable: true; showAll: boolean; top: number; onToggle: () => void }
  | { toggleable: false; count: number };

function Card({
  title,
  header,
  children,
}: {
  title: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center justify-between border-b border-surface-divider px-3 text-[11px] font-medium tracking-wide text-muted-foreground">
        <h3 className="truncate text-foreground/70">{title}</h3>
        {header}
      </div>
      {children}
    </div>
  );
}

// Right side of the header: a button toggling field ⇄ Top-N, or a static count
// for a fixed list.
function HeaderControl({ header }: { header: StageOddsHeader }) {
  if (!header.toggleable)
    return (
      <span className="shrink-0 text-muted-foreground/60">
        {header.count} {header.count === 1 ? "country" : "countries"}
      </span>
    );
  return (
    <button
      type="button"
      onClick={header.onToggle}
      className="shrink-0 rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {header.showAll ? "All teams" : `Top ${header.top}`}
    </button>
  );
}

function StageGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(STAGE_GRID, className)}>{children}</div>;
}

// A heat-mapped probability cell. A stage the team has *actually* reached (per
// results) shows a green check; a stage it is *confirmed out* of shows a muted
// cross; anything still open shows its predicted number (floored at "<1%", never
// 100% as a check) with the green deepening as the chance grows.
function HeatCell({
  value,
  reached,
  eliminated,
}: {
  value: number;
  reached: boolean;
  eliminated: boolean;
}) {
  if (reached)
    return (
      <span
        className="flex h-7 w-full items-center justify-center rounded-[3px] text-pick"
        style={{
          backgroundColor: "color-mix(in oklab, var(--pick) 22%, transparent)",
        }}
      >
        <Check className="size-3.5" aria-label="Reached" />
      </span>
    );

  if (eliminated)
    return (
      <span
        className="flex h-7 w-full items-center justify-center rounded-[3px] text-muted-foreground/50"
        style={{
          backgroundColor:
            "color-mix(in oklab, var(--muted-foreground) 9%, transparent)",
        }}
      >
        <X className="size-3.5" aria-label="Eliminated" />
      </span>
    );

  const tint = Math.round(value * 88);
  const strong = value >= 0.5;
  return (
    <span
      className={cn(
        "flex h-7 w-full items-center justify-center rounded-[3px] text-[11px] tabular-nums @lg:text-[12px]",
        strong ? "font-semibold text-foreground" : "text-muted-foreground",
      )}
      style={{
        backgroundColor: `color-mix(in oklab, var(--pick) ${tint}%, transparent)`,
      }}
    >
      {formatPct(value)}
    </span>
  );
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-center text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
      {children}
    </span>
  );
}

// Every plausible opponent in one match, biggest first — a single locked-in
// opponent drops its "100%".
function OpponentList({ opponents }: { opponents: PathOpponent[] }) {
  const shown = opponents.filter((o) => o.probability >= 0.05);
  if (!shown.length)
    return <span className="text-muted-foreground/60">to be decided</span>;
  const locked = shown.length === 1 && shown[0].probability >= 0.99;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {shown.map((o) => (
        <span key={o.code} className="flex items-center gap-1">
          <Flag code={o.code} size={12} />
          <span className="font-medium">{o.code}</span>
          {!locked && (
            <span className="text-muted-foreground tabular-nums">
              {roundPct(o.probability)}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

// The why-this-number content: the matches the team must win to reach the round,
// each with its likely opponents and the running reach. Chrome comes from the
// popover that hosts it.
function CellExplain({ path }: { path: CellPath }) {
  return (
    <div className="text-[11px]">
      <p className="mb-1.5 text-muted-foreground">
        To reach the {ROUND_LABEL[path.targetRound]},{" "}
        <span className="text-foreground">{path.name}</span> must get past
        {path.dependsOnGroup ? " (depends on its group finish)" : ""}:
      </p>
      <div className="flex flex-col gap-1.5">
        {path.legs.map((leg) => (
          <div
            key={leg.round}
            className="grid grid-cols-[4.5rem_1fr_auto] items-start gap-2"
          >
            <span className="pt-px text-muted-foreground/80">
              {ROUND_LABEL[leg.round]}
            </span>
            <OpponentList opponents={leg.opponents} />
            <span className="pt-px text-foreground tabular-nums">
              {roundPct(leg.reachNext)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A click-opened tooltip anchored to a cell. Portaled to the body and positioned
// fixed, so it floats over the table without shifting layout or being clipped by
// the card. Re-places on scroll/resize, follows the anchor, and closes on an
// outside click, Escape, or the anchor leaving the page.
function CellPopover({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      if (!anchor.isConnected) return onClose();
      const a = anchor.getBoundingClientRect();
      const { offsetWidth: w, offsetHeight: h } = el;
      const margin = 8;
      const left = Math.min(
        Math.max(margin, a.left + a.width / 2 - w / 2),
        window.innerWidth - w - margin,
      );
      const below = a.bottom + 6;
      const top =
        below + h > window.innerHeight - margin && a.top - h - 6 > margin
          ? a.top - h - 6
          : below;
      setPos({ top, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
      className="fixed z-50 max-h-[60vh] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-lg border border-border-strong bg-card p-2.5 shadow-xl"
    >
      {children}
    </div>,
    document.body,
  );
}

function StageRow({
  row,
  openRound,
  onToggle,
  canExplain,
}: {
  row: StageOddsRow;
  openRound: Round | null;
  onToggle: (round: Round, anchor: HTMLElement) => void;
  canExplain: boolean;
}) {
  return (
    <StageGrid className="h-7">
      <span className="flex min-w-0 items-center gap-1.5 @lg:gap-2">
        <Flag code={row.code} size={14} />
        <span className="min-w-0 truncate text-[12px] font-medium @lg:text-[13px]">
          <span className="@lg:hidden">{row.code}</span>
          <span className="hidden @lg:inline">{row.name ?? row.code}</span>
        </span>
      </span>
      {STAGES.map((stage, idx) => {
        const reached = idx <= row.reachedIdx;
        const cell = (
          <HeatCell
            value={row[stage.key]}
            reached={reached}
            eliminated={row.eliminated}
          />
        );
        // Only an open prediction in a reach column with a real chance has a
        // story to tell.
        const interactive =
          canExplain &&
          "round" in stage &&
          !reached &&
          !row.eliminated &&
          row[stage.key] >= 0.005;
        if (!interactive) return <span key={stage.key}>{cell}</span>;

        const isOpen = openRound === stage.round;
        return (
          <button
            key={stage.key}
            type="button"
            aria-expanded={isOpen}
            onClick={(e) => onToggle(stage.round, e.currentTarget)}
            className={cn(
              "block w-full rounded-[3px] transition-shadow hover:ring-1 hover:ring-pick/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isOpen && "ring-1 ring-pick/60",
            )}
          >
            {cell}
          </button>
        );
      })}
    </StageGrid>
  );
}

type StageOddsCardProps =
  | { loading: true }
  | {
      loading?: false;
      rows: StageOddsRow[];
      header: StageOddsHeader;
      resolveBreakdown?: ResolveBreakdown;
    };

/** A heat-map table of each team's chance to reach every knockout round and win
 *  the cup — the "road to the final" at a glance. Clicking a reach cell opens the
 *  matches behind that number. */
export function StageOddsCard(props: StageOddsCardProps) {
  // The cell whose breakdown is open (team + round + the clicked cell to anchor
  // the popover to); null when none.
  const [open, setOpen] = useState<{
    code: string;
    round: Round;
    anchor: HTMLElement;
  } | null>(null);

  const resolve = props.loading ? undefined : props.resolveBreakdown;
  const breakdown =
    open && resolve ? resolve(open.code, open.round) : undefined;

  return (
    <Card
      title="Chance to reach each round"
      header={
        props.loading ? undefined : <HeaderControl header={props.header} />
      }
    >
      <div className="@container flex flex-col gap-1 px-2.5 py-2">
        <StageGrid className="pb-1">
          <span className="pl-0.5 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
            Team
          </span>
          {STAGES.map((stage) => (
            <ColumnLabel key={stage.key}>{stage.label}</ColumnLabel>
          ))}
        </StageGrid>
        {props.loading
          ? ROW_SKELETON.map((key) => (
              <div key={key} className="flex h-7 items-center">
                <Skeleton className="h-5 w-full" />
              </div>
            ))
          : props.rows.map((row) => (
              <StageRow
                key={row.code}
                row={row}
                openRound={open?.code === row.code ? open.round : null}
                onToggle={(round, anchor) =>
                  setOpen((cur) =>
                    cur && cur.code === row.code && cur.round === round
                      ? null
                      : { code: row.code, round, anchor },
                  )
                }
                canExplain={Boolean(resolve)}
              />
            ))}
      </div>
      {open && breakdown && (
        <CellPopover anchor={open.anchor} onClose={() => setOpen(null)}>
          <CellExplain path={breakdown} />
        </CellPopover>
      )}
    </Card>
  );
}

// MatchWidget — a self-contained card for a single match: two teams, score,
// status/clock, optional kickoff time and win odds. Pure presentation: it
// fetches nothing — the caller passes everything in. Flags come from the shared
// spritesheet via <Flag>, keyed by team code, so the card costs no per-flag
// requests.
//
// Needs Tailwind plus a few theme tokens (card, foreground, muted,
// muted-foreground, surface-border, surface-divider, pick); the props are
// documented on the interfaces below.

import { Flag } from "@/components/flags";
import { Card } from "@/components/ui/card";

import { cn } from "cnfast";

export type MatchStatus = "scheduled" | "live" | "final";

export interface MatchTeam {
  code: string;
  name?: string;
  score?: number | null;
  winner?: boolean;
}

/** Win chances for the two sides; should sum to ~1 (the draw is dropped). */
export interface MatchPrediction {
  homeWin: number;
  awayWin: number;
}

export interface MatchWidgetProps {
  number: number;
  /** Short stage label, e.g. "Group H" or "R32". */
  phaseLabel?: string;
  status: MatchStatus;
  /** Live minute ("63'"), "FT", or kickoff text from the feed. */
  detail?: string;
  /** Show the "Live" badge in the header — pass for a match in progress. */
  live?: boolean;
  /** Kickoff label ("JUL 22, 12hs") shown in the header when not live. */
  kickoff?: string;
  home: MatchTeam;
  away: MatchTeam;
  /** Optional market-derived win odds, rendered as a bar under the score. */
  prediction?: MatchPrediction;
}

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

// Small muted caption used for the status, kickoff and "Odds" labels. Size,
// color and alignment vary per use, so the caller passes them via className.
function Caption({
  className,
  children,
}: {
  className?: string;
  children: string;
}) {
  return (
    <span
      className={cn("font-medium uppercase leading-4 tracking-wide", className)}
    >
      {children}
    </span>
  );
}

function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 rounded-full bg-rose-400 animate-pulse",
        className,
      )}
    />
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold tracking-wide text-rose-400 uppercase">
      <LiveDot className="size-1.5" />
      Live
    </span>
  );
}

// Period/clock shown above the score: live minute ("53'"), "FT", or kickoff.
function MatchStatusLabel({
  status,
  detail,
}: {
  status: MatchStatus;
  detail?: string;
}) {
  const text =
    detail ||
    (status === "live"
      ? "Live"
      : status === "final"
        ? "Full time"
        : "Upcoming");

  return (
    <Caption
      className={cn(
        "text-center",
        status === "live"
          ? "text-xs text-rose-400"
          : status === "final"
            ? "text-xs text-pick"
            : "text-xs text-muted-foreground/75",
      )}
    >
      {text}
    </Caption>
  );
}

function TeamColumn({
  team,
  status,
}: {
  team: MatchTeam;
  status: MatchStatus;
}) {
  // At full time the loser is dimmed so the winner reads clearly.
  const settled = status === "final";
  const dimmed = settled && team.winner === false;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-1.5 pt-1",
        dimmed && "opacity-50",
      )}
    >
      <Flag code={team.code} size={32} />
      <span
        className={cn(
          "text-sm font-semibold tracking-wide",
          settled && team.winner ? "text-pick" : "text-foreground",
        )}
      >
        {team.code}
      </span>
      <span
        className="max-w-[8rem] truncate text-center text-xs leading-tight text-muted-foreground"
        title={team.name}
      >
        {team.name}
      </span>
    </div>
  );
}

// Win chances shown under the score, one per side. The leader is emphasized.
function OddsLine({ prediction }: { prediction: MatchPrediction }) {
  const homeLead = prediction.homeWin >= prediction.awayWin;

  return (
    <div className="mt-2 flex flex-col items-center">
      <Caption className="text-center text-xs text-muted-foreground/75">
        Odds
      </Caption>
      <div className="flex items-center gap-1 text-xs tabular-nums">
        <span
          className={cn(
            homeLead ? "font-semibold text-pick" : "text-muted-foreground",
          )}
        >
          {formatPct(prediction.homeWin)}
        </span>
        <span className="text-muted-foreground/40">-</span>
        <span
          className={cn(
            !homeLead ? "font-semibold text-pick" : "text-muted-foreground",
          )}
        >
          {formatPct(prediction.awayWin)}
        </span>
      </div>
    </div>
  );
}

function Score({
  status,
  home,
  away,
}: {
  status: MatchStatus;
  home: MatchTeam;
  away: MatchTeam;
}) {
  // Before kickoff there is no score yet — show a muted "0 – 0" so the layout
  // stays identical to a played match.
  const played =
    status !== "scheduled" && home.score != null && away.score != null;
  const h = home.score ?? 0;
  const a = away.score ?? 0;

  return (
    <span
      className={cn(
        "text-xl font-semibold leading-none tabular-nums",
        played ? "text-foreground" : "text-muted-foreground/40",
      )}
    >
      {h}
      <span
        className={cn(
          "mx-1.5",
          played ? "text-muted-foreground/50" : "text-muted-foreground/30",
        )}
      >
        –
      </span>
      {a}
    </span>
  );
}

export function MatchWidget({
  number,
  phaseLabel,
  status,
  detail,
  live,
  kickoff,
  home,
  away,
  prediction,
}: MatchWidgetProps) {
  return (
    <Card className="flex h-36 flex-col">
      <div className="flex h-7 items-center justify-between gap-2 border-b border-surface-divider px-3 text-xs font-medium text-muted-foreground tabular-nums tracking-wide">
        <span className="min-w-0 truncate text-foreground/70">
          #{number}
          {phaseLabel ? ` · ${phaseLabel}` : ""}
        </span>
        {live ? (
          <LiveBadge />
        ) : kickoff ? (
          <Caption className="shrink-0 text-xs text-muted-foreground/75">
            {kickoff}
          </Caption>
        ) : null}
      </div>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 px-3 py-3">
        <TeamColumn team={home} status={status} />
        <div className="flex flex-col items-center gap-1.5">
          <MatchStatusLabel status={status} detail={detail} />
          <Score status={status} home={home} away={away} />
          {prediction && <OddsLine prediction={prediction} />}
        </div>
        <TeamColumn team={away} status={status} />
      </div>
    </Card>
  );
}

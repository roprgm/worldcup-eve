import { cn } from "cnfast";
import { FlagImage, LiveBadge } from "@/components/widgets/primitives";

// Presentation-only match card. The caller owns the data shape, scores,
// prediction, and live/final status mapping.

export type MatchStatus = "scheduled" | "live" | "final";

export interface MatchTeam {
  code: string;
  name?: string;
  flagSrc?: string;
  score?: number | null;
  winner?: boolean;
}

export interface MatchPrediction {
  homeWin: number;
  awayWin: number;
}

export interface MatchWidgetProps {
  number: number;
  phaseLabel?: string;
  status: MatchStatus;
  detail?: string;
  live?: boolean;
  kickoff?: string;
  home: MatchTeam;
  away: MatchTeam;
  prediction?: MatchPrediction;
}

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

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
          ? "text-[11px] text-rose-400"
          : status === "final"
            ? "text-[10px] text-pick"
            : "text-[10px] text-muted-foreground/75",
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
  const settled = status === "final";
  const dimmed = settled && team.winner === false;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-1.5 pt-1",
        dimmed && "opacity-50",
      )}
    >
      <FlagImage src={team.flagSrc} size={32} />
      <span
        className={cn(
          "text-[13px] font-semibold tracking-wide",
          settled && team.winner ? "text-pick" : "text-foreground",
        )}
      >
        {team.code}
      </span>
      <span
        className="max-w-[8rem] truncate text-center text-[10px] leading-tight text-muted-foreground"
        title={team.name}
      >
        {team.name}
      </span>
    </div>
  );
}

function OddsLine({ prediction }: { prediction: MatchPrediction }) {
  const homeLead = prediction.homeWin >= prediction.awayWin;

  return (
    <div className="mt-2 flex flex-col items-center">
      <Caption className="text-center text-[10px] text-muted-foreground/75">
        Odds
      </Caption>
      <div className="flex items-center gap-1 text-[11px] tabular-nums">
        <span
          className={
            homeLead ? "font-semibold text-pick" : "text-muted-foreground"
          }
        >
          {formatPct(prediction.homeWin)}
        </span>
        <span className="text-muted-foreground/40">-</span>
        <span
          className={
            !homeLead ? "font-semibold text-pick" : "text-muted-foreground"
          }
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
  const played =
    status !== "scheduled" && home.score != null && away.score != null;
  const h = home.score ?? 0;
  const a = away.score ?? 0;

  return (
    <span
      className={cn(
        "text-2xl font-semibold leading-none tabular-nums",
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
    <div className="flex h-36 flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-surface-divider px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground tabular-nums">
        <span className="min-w-0 truncate text-foreground/70">
          #{number}
          {phaseLabel ? ` · ${phaseLabel}` : ""}
        </span>
        {live ? (
          <LiveBadge />
        ) : kickoff ? (
          <Caption className="shrink-0 text-[10px] text-muted-foreground/75">
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
    </div>
  );
}

import { Flag } from "@/components/flags";

import { cn } from "cnfast";

const MAX_PER_SIDE = 8;
const MIN_PROBABILITY = 0.01;

type SideName = "home" | "away";

interface Candidate {
  code: string;
  probability: number;
  name?: string;
}

interface MatchSide {
  label: string;
  candidates: Candidate[];
  showAll?: boolean;
}

interface PredictionMatchCardProps {
  number: number;
  phaseLabel: string;
  dateTime: string;
  location?: string;
  title?: string;
  home: MatchSide;
  away: MatchSide;
}

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function topCandidates(list: Candidate[], showAll = false): Candidate[] {
  const kept = showAll
    ? list
    : list.filter((c) => c.probability >= MIN_PROBABILITY);
  return kept.slice(0, MAX_PER_SIDE);
}

function CandidateRow({
  candidate,
  side,
  lead,
}: {
  candidate: Candidate;
  side: SideName;
  lead: boolean;
}) {
  const isZero = Math.round(candidate.probability * 100) === 0;
  const flag = <Flag code={candidate.code} size={14} />;
  const code = (
    <span
      title={candidate.name}
      className={cn(
        "w-8 shrink-0 text-[12px] font-semibold tracking-wide",
        lead ? "text-foreground" : "text-muted-foreground",
        side === "home" ? "text-left" : "text-right",
      )}
    >
      {candidate.code}
    </span>
  );
  const value = (
    <span
      className={cn(
        "min-w-10 text-[12px] tabular-nums",
        lead
          ? "font-semibold text-foreground"
          : isZero
            ? "text-muted-foreground/45"
            : "text-muted-foreground",
        side === "home" ? "text-right" : "text-left",
      )}
    >
      {formatPct(candidate.probability)}
    </span>
  );
  const bar = (
    <span className="flex h-2 flex-1 overflow-hidden rounded-[1px] bg-muted/50">
      <span
        className={cn(
          "h-full rounded-[1px]",
          lead ? "bg-pick" : "bg-muted-foreground/30",
          side === "away" && "ml-auto",
        )}
        style={{ width: formatPct(candidate.probability) }}
      />
    </span>
  );

  return side === "home" ? (
    <div className="flex h-5 items-center gap-1.5">
      {flag}
      {code}
      {bar}
      {value}
    </div>
  ) : (
    <div className="flex h-5 items-center gap-1.5">
      {value}
      {bar}
      {code}
      {flag}
    </div>
  );
}

function Side({ data, side }: { data: MatchSide; side: SideName }) {
  const shown = topCandidates(data.candidates, data.showAll);
  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-3 py-2",
        side === "away" && "border-l border-surface-border",
      )}
    >
      <p
        className={cn(
          "truncate text-[11px] leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase",
          side === "home" ? "text-left" : "text-right",
        )}
      >
        {data.label}
      </p>
      <div className="min-h-[92px] space-y-1">
        {shown.length === 0 ? (
          <p
            className={cn(
              "text-[12px] text-muted-foreground/40 italic",
              side === "away" && "text-right",
            )}
          >
            no market
          </p>
        ) : (
          shown.map((candidate, i) => (
            <CandidateRow
              key={candidate.code}
              candidate={candidate}
              side={side}
              lead={i === 0}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function PredictionMatchCard({
  number,
  phaseLabel,
  dateTime,
  location,
  title,
  home,
  away,
}: PredictionMatchCardProps) {
  return (
    <div
      title={title}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-surface-border bg-card"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-surface-divider px-3 py-1.5 text-[11px] font-medium text-muted-foreground tabular-nums tracking-wide">
        <span className="min-w-0 truncate text-left text-foreground/70">
          #{number} - {phaseLabel}
        </span>
        <span className="text-center uppercase">{dateTime}</span>
        <span className="min-w-0 truncate text-right" title={title}>
          {location}
        </span>
      </div>
      <div className="grid flex-1 grid-cols-2">
        <Side data={home} side="home" />
        <Side data={away} side="away" />
      </div>
    </div>
  );
}

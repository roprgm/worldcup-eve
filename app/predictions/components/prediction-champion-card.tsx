import { Trophy } from "lucide-react";

import { cn } from "cnfast";

const MIN_PROBABILITY = 0.01;

interface ChampionCandidate {
  code: string;
  probability: number;
  name?: string;
  flagSrc?: string;
}

interface PredictionChampionCardProps {
  candidates: ChampionCandidate[];
}

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function FlagImage({ src, size }: { src?: string; size: number }) {
  const height = Math.round((size * 3) / 4);
  const className = "inline-block shrink-0 rounded-[2px] ring-1 ring-white/15";

  if (!src) {
    return (
      <span
        aria-hidden
        style={{ width: size, height }}
        className={cn(className, "bg-muted")}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      width={size}
      height={height}
      style={{ width: size, height }}
      className={cn(className, "object-cover")}
    />
  );
}

export function PredictionChampionCard({
  candidates,
}: PredictionChampionCardProps) {
  const champ = candidates.filter((c) => c.probability >= MIN_PROBABILITY);
  const leader = champ[0];

  return (
    <div className="mb-4 flex flex-col items-center gap-2 pt-2">
      <span className="h-4 w-px bg-border" />
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-pick/40 bg-card px-6 py-3 ring-1 ring-pick/10">
        <Trophy
          className={cn(
            "size-5",
            leader ? "text-pick" : "text-muted-foreground/40",
          )}
        />
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Most likely champion
        </span>
        {leader ? (
          <div className="flex items-center gap-2">
            <FlagImage src={leader.flagSrc} size={20} />
            <span className="text-base font-semibold text-pick">
              {leader.name ?? leader.code}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatPct(leader.probability)}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground/50">—</span>
        )}
        {champ.length > 1 && (
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {champ.slice(1, 5).map((candidate) => (
              <span
                key={candidate.code}
                className="flex items-center gap-1 text-[12px] text-muted-foreground"
              >
                <FlagImage src={candidate.flagSrc} size={12} />
                <span className="font-medium">{candidate.code}</span>
                <span className="tabular-nums">
                  {formatPct(candidate.probability)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

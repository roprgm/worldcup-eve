"use client";

import { cn } from "cnfast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

type Dir = "prev" | "next";

const arrowClass =
  "flex size-9 shrink-0 items-center justify-center rounded-full border border-surface-border bg-card text-muted-foreground transition-colors";

function Arrow({
  dir,
  disabled,
  onClick,
}: {
  dir: Dir;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous run" : "Next run"}
      className={cn(
        arrowClass,
        disabled
          ? "opacity-25"
          : "hover:border-border-strong hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

/** The run's title line: the model name with its leaderboard rank, flanked by
 *  arrows that step to the prev/next run. Stepping is instant (client state —
 *  everything is already loaded); left/right arrow keys work too. Omit onPrev/
 *  onNext for a standalone title with no stepping. */
export function RunNav({
  title,
  rank,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: {
  title: string;
  /** e.g. "Rank 4 of 5"; empty when the run stands alone. */
  rank?: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const paged = Boolean(onPrev || onNext);

  useEffect(() => {
    if (!paged) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowLeft" && hasPrev) onPrev?.();
      if (e.key === "ArrowRight" && hasNext) onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged, hasPrev, hasNext, onPrev, onNext]);

  return (
    <div className="flex items-center gap-3">
      {paged && (
        <Arrow dir="prev" disabled={!hasPrev} onClick={() => onPrev?.()} />
      )}
      <div className="min-w-0 flex-1 text-center">
        <h2 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {rank && (
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground/70">
            {rank}
          </p>
        )}
      </div>
      {paged && (
        <Arrow dir="next" disabled={!hasNext} onClick={() => onNext?.()} />
      )}
    </div>
  );
}

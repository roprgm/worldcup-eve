"use client";

import { cn } from "cnfast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export interface NavNeighbor {
  slug: string;
  label: string;
}

const arrowClass =
  "flex size-9 shrink-0 items-center justify-center rounded-full border border-surface-border bg-card text-muted-foreground transition-colors";

function Arrow({
  dir,
  neighbor,
}: {
  dir: "prev" | "next";
  neighbor?: NavNeighbor;
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  if (!neighbor)
    return (
      <span
        aria-hidden
        className={cn(arrowClass, "pointer-events-none opacity-25")}
      >
        <Icon className="size-5" />
      </span>
    );
  return (
    <Link
      href={`/arena/${neighbor.slug}`}
      title={neighbor.label}
      aria-label={`${dir === "prev" ? "Previous" : "Next"}: ${neighbor.label}`}
      className={cn(
        arrowClass,
        "hover:border-border-strong hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <Icon className="size-5" />
    </Link>
  );
}

/** The run's title line: the model name with its leaderboard rank, flanked by
 *  arrows that step to the prev/next run (in the same order as the leaderboard)
 *  while the bracket below stays in place. Left/right arrow keys work too. */
export function RunNav({
  title,
  rank,
  prev,
  next,
}: {
  title: string;
  /** e.g. "Rank 4 of 5"; empty when the run stands alone. */
  rank?: string;
  prev?: NavNeighbor;
  next?: NavNeighbor;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowLeft" && prev) router.push(`/arena/${prev.slug}`);
      if (e.key === "ArrowRight" && next) router.push(`/arena/${next.slug}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  const paged = Boolean(prev || next || rank);

  return (
    <div className="flex items-center gap-3">
      {paged && <Arrow dir="prev" neighbor={prev} />}
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
      {paged && <Arrow dir="next" neighbor={next} />}
    </div>
  );
}

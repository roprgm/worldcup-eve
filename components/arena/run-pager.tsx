"use client";

import { cn } from "cnfast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export interface PagerNeighbor {
  slug: string;
  label: string;
}

const baseClass =
  "flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors";

/** Prev/next navigation between runs, like flipping through a gallery: the
 *  bracket stays in the same spot while you step across models to watch the
 *  predictions change. Left/right arrow keys work too. */
export function RunPager({
  prev,
  next,
  position,
}: {
  prev?: PagerNeighbor;
  next?: PagerNeighbor;
  position: string;
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

  return (
    <nav className="flex items-center justify-between gap-2 text-muted-foreground">
      {prev ? (
        <Link
          href={`/arena/${prev.slug}`}
          className={cn(baseClass, "hover:bg-surface hover:text-foreground")}
        >
          <ChevronLeft className="size-4 shrink-0" />
          <span className="truncate">{prev.label}</span>
        </Link>
      ) : (
        <span className={cn(baseClass, "opacity-40")}>
          <ChevronLeft className="size-4 shrink-0" />
        </span>
      )}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
        {position}
      </span>
      {next ? (
        <Link
          href={`/arena/${next.slug}`}
          className={cn(
            baseClass,
            "justify-end hover:bg-surface hover:text-foreground",
          )}
        >
          <span className="truncate">{next.label}</span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      ) : (
        <span className={cn(baseClass, "justify-end opacity-40")}>
          <ChevronRight className="size-4 shrink-0" />
        </span>
      )}
    </nav>
  );
}

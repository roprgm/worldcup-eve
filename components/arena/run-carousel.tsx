"use client";

import { cn } from "cnfast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

export interface CarouselNeighbor {
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
  neighbor?: CarouselNeighbor;
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

/** The bracket as a carousel slide: an arrow on each side steps to the prev/next
 *  run (in leaderboard order) while the bracket stays in place, so you can watch
 *  the predictions change model to model. Left/right arrow keys work too. */
export function RunCarousel({
  prev,
  next,
  position,
  children,
}: {
  prev?: CarouselNeighbor;
  next?: CarouselNeighbor;
  position: string;
  children: ReactNode;
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
    <div>
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        <Arrow dir="prev" neighbor={prev} />
        <div className="min-w-0 w-full max-w-lg">{children}</div>
        <Arrow dir="next" neighbor={next} />
      </div>
      {position && (
        <p className="mt-3 text-center text-xs tabular-nums text-muted-foreground/70">
          {position}
        </p>
      )}
    </div>
  );
}

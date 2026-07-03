"use client";

import { cn } from "cnfast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export interface NavNeighbor {
  slug: string;
  label: string;
}

type Dir = "prev" | "next";

// startViewTransition isn't in the DOM lib types yet.
type VTDocument = Document & {
  startViewTransition?: (cb: () => Promise<void> | void) => {
    finished: Promise<void>;
  };
};

const arrowClass =
  "flex size-9 shrink-0 items-center justify-center rounded-full border border-surface-border bg-card text-muted-foreground transition-colors";

function Arrow({
  dir,
  neighbor,
  onNavigate,
}: {
  dir: Dir;
  neighbor?: NavNeighbor;
  onNavigate: (dir: Dir, slug: string) => void;
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
      onClick={(e) => {
        // Plain click slides; modifier/middle clicks keep the native behaviour.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate(dir, neighbor.slug);
      }}
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
 *  arrows that step to the prev/next run. Neighbours are prefetched so the jump
 *  is instant, and the step plays a sideways carousel slide (View Transitions
 *  API, where supported). Left/right arrow keys work too. */
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
  const pathname = usePathname();

  // Resolves the pending view transition once the new route has committed, so
  // the slide captures the incoming page rather than the old one.
  const resolveRef = useRef<(() => void) | null>(null);
  const settle = () => {
    const resolve = resolveRef.current;
    if (resolve) {
      resolveRef.current = null;
      resolve();
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire when the route commits
  useEffect(settle, [pathname]);

  // Warm the client cache for the neighbours so navigating is immediate.
  useEffect(() => {
    if (prev) router.prefetch(`/arena/${prev.slug}`);
    if (next) router.prefetch(`/arena/${next.slug}`);
  }, [prev, next, router]);

  const go = (dir: Dir, slug: string) => {
    const url = `/arena/${slug}`;
    const doc = document as VTDocument;
    const start = doc.startViewTransition?.bind(doc);
    if (!start) {
      router.push(url);
      return;
    }
    const root = document.documentElement;
    root.dataset.arenaNav = dir; // direction drives the slide, see globals.css
    const transition = start(
      () =>
        new Promise<void>((resolve) => {
          resolveRef.current = resolve;
          router.push(url);
          // Safety net if the route doesn't change (e.g. already there).
          window.setTimeout(settle, 500);
        }),
    );
    transition.finished.finally(() => {
      if (root.dataset.arenaNav === dir) delete root.dataset.arenaNav;
    });
  };

  // Keep the key handler pinned to the latest neighbours without re-binding.
  const goRef = useRef(go);
  goRef.current = go;
  const neighborsRef = useRef({ prev, next });
  neighborsRef.current = { prev, next };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const { prev: p, next: n } = neighborsRef.current;
      if (e.key === "ArrowLeft" && p) goRef.current("prev", p.slug);
      if (e.key === "ArrowRight" && n) goRef.current("next", n.slug);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const paged = Boolean(prev || next || rank);

  return (
    <div className="flex items-center gap-3">
      {paged && <Arrow dir="prev" neighbor={prev} onNavigate={go} />}
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
      {paged && <Arrow dir="next" neighbor={next} onNavigate={go} />}
    </div>
  );
}

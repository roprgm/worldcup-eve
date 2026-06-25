import { cn } from "cnfast";

// Small primitives shared by the match and group widgets. Kept here so the
// widgets stay DRY without re-declaring the same flag/live helpers in each file.

/** A flag chip. Falls back to a neutral placeholder when no `src` is given. */
export function FlagImage({ src, size }: { src?: string; size: number }) {
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

export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 animate-pulse rounded-full bg-rose-400",
        className,
      )}
    />
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-rose-400">
      <LiveDot className="size-1.5" />
      Live
    </span>
  );
}

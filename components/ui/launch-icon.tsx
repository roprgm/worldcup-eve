import { cn } from "cnfast";
import type { ReactNode } from "react";

/**
 * Two stacked marks in the same spot: `idle` sits in place, `active` is hidden.
 * When `launching` flips true, `idle` fades out and `active` kicks up and out of
 * the top — give the parent `overflow-hidden` to clip the launch.
 */
export function LaunchIcon({
  idle,
  active,
  launching,
  className,
}: {
  idle: ReactNode;
  active: ReactNode;
  launching: boolean;
  className?: string;
}) {
  const reset =
    "col-start-1 row-start-1 transition-[opacity,transform] duration-150 ease-[var(--ease-geist)]";
  return (
    <span
      data-launching={launching}
      className={cn("group/launch inline-grid place-items-center", className)}
    >
      <span
        className={cn(
          reset,
          "group-data-[launching=true]/launch:animate-launch-out",
        )}
      >
        {idle}
      </span>
      <span
        className={cn(
          reset,
          "opacity-0 group-data-[launching=true]/launch:animate-launch-kick",
        )}
      >
        {active}
      </span>
    </span>
  );
}

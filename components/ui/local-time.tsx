"use client";

import { cn } from "cnfast";
import { type ReactNode, useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";

// Rows show a full date + time + zone so the instant is unambiguous.
const DETAIL: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

// IANA id → human label: "America/Mexico_City" → "Mexico City", "UTC" → "UTC".
function zoneLabel(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function ZoneRow({ zone, date }: { zone: string; date: Date }) {
  return (
    <div className="flex items-baseline justify-between gap-5">
      <span className="text-xs text-muted-foreground">{zoneLabel(zone)}</span>
      <span className="text-sm whitespace-nowrap tabular-nums">
        {new Intl.DateTimeFormat(undefined, {
          ...DETAIL,
          timeZone: zone,
        }).format(date)}
      </span>
    </div>
  );
}

// Tap-through detail: the instant in the reader's own zone and UTC.
function ZoneBreakdown({ date }: { date: Date }) {
  const local = readerZone();
  const zones = local === "UTC" ? ["UTC"] : [local, "UTC"];
  return (
    <div className="flex flex-col gap-1.5">
      {zones.map((zone) => (
        <ZoneRow key={zone} zone={zone} date={date} />
      ))}
    </div>
  );
}

/**
 * Wraps an agent-written date/time so it can be tapped to see the instant across
 * zones. The agent writes the human text itself (in the user's zone and
 * language, via the convert_time tool) and passes the raw UTC instant as `iso`;
 * this component only renders that text and reveals the breakdown on tap, so it
 * never has to phrase anything and the agent owns the wording.
 */
export function LocalTime({
  iso,
  children,
}: {
  iso?: string;
  children?: ReactNode;
}) {
  const date = useMemo(() => {
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [iso]);

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!date) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor((cur) => (cur ? null : e.currentTarget))}
        className={cn(
          "cursor-pointer underline decoration-dotted decoration-muted-foreground/50",
          "underline-offset-2 hover:decoration-foreground",
        )}
      >
        <time dateTime={iso}>{children}</time>
      </button>
      <Popover
        open={Boolean(anchor)}
        anchor={anchor}
        onClose={() => setAnchor(null)}
        className="w-max max-w-[min(18rem,calc(100vw-1rem))] p-3"
      >
        <ZoneBreakdown date={date} />
      </Popover>
    </>
  );
}

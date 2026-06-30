"use client";

import { cn } from "cnfast";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";

type TimeFormat = "datetime" | "date" | "time";

// Locale-aware presets for the inline value. The reader's runtime — or an
// explicit `tz` — supplies the actual zone.
const FORMATS: Record<TimeFormat, Intl.DateTimeFormatOptions> = {
  datetime: {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
  date: { weekday: "short", month: "short", day: "numeric" },
  time: { hour: "numeric", minute: "2-digit", timeZoneName: "short" },
};

// Breakdown rows always show a full date + time so the instant is unambiguous.
const DETAIL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

function asFormat(value: unknown): TimeFormat {
  return value === "date" || value === "time" ? value : "datetime";
}

// IANA id → human label: "America/Mexico_City" → "Mexico City", "UTC" → "UTC".
function zoneLabel(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

// Format an instant in a zone; null on a bad instant or an unknown zone (the
// model can pass an invalid IANA name).
function formatIn(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  zone?: string,
): string | null {
  try {
    const opts = zone ? { ...options, timeZone: zone } : options;
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  } catch {
    return null;
  }
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function ZoneRow({
  zone,
  value,
  primary,
}: {
  zone: string;
  value: string;
  primary: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-5">
      <span
        className={cn(
          "text-xs",
          primary ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {zoneLabel(zone)}
      </span>
      <span className="text-sm whitespace-nowrap tabular-nums">{value}</span>
    </div>
  );
}

// The same instant across the zone the reader sees inline, their own device
// zone, and UTC — so a tap explains what the localized value actually is.
function ZoneBreakdown({ date, tz }: { date: Date; tz?: string }) {
  const local = readerZone();
  const primary = tz || local;
  const zones = [primary, local, "UTC"].filter(
    (zone, i, all) => all.indexOf(zone) === i,
  );
  return (
    <div className="flex flex-col gap-1.5">
      {zones.map((zone) => {
        const value = formatIn(date, DETAIL_FORMAT, zone);
        return value ? (
          <ZoneRow
            key={zone}
            zone={zone}
            value={value}
            primary={zone === primary}
          />
        ) : null;
      })}
    </div>
  );
}

/**
 * Renders a UTC instant in a target locale and time zone. The agent emits
 * `<local-time iso="...Z">fallback</local-time>` with the raw UTC instant it
 * already has; the browser does the conversion here, so the model never has to
 * do timezone math (it kept getting that wrong). By default the reader's own
 * zone is used; the agent can pass `tz="Europe/Madrid"` when the user asks for a
 * specific place's local time. A tap reveals the same instant across zones.
 *
 * Formatting is deferred to a mount effect: the server has no reader time zone,
 * so the UTC fallback renders first (matching SSR, degrading without JS) and the
 * localized value swaps in on the client.
 */
export function LocalTime({
  iso,
  format,
  tz,
  children,
}: {
  iso?: string;
  format?: string;
  tz?: string;
  children?: ReactNode;
}) {
  const date = useMemo(() => {
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [iso]);

  const [display, setDisplay] = useState<string | null>(null);
  useEffect(() => {
    if (date) setDisplay(formatIn(date, FORMATS[asFormat(format)], tz));
  }, [date, format, tz]);

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!date) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor((cur) => (cur ? null : e.currentTarget))}
        className="cursor-pointer underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 hover:decoration-foreground"
      >
        <time dateTime={iso}>{display ?? children}</time>
      </button>
      <Popover
        open={Boolean(anchor)}
        anchor={anchor}
        onClose={() => setAnchor(null)}
        className="w-max max-w-[min(18rem,calc(100vw-1rem))] p-3"
      >
        <ZoneBreakdown date={date} tz={tz} />
      </Popover>
    </>
  );
}

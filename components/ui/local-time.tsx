"use client";

import { cn } from "cnfast";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";

type TimeFormat = "auto" | "datetime" | "date" | "time";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Minimal inline presets — no zone name; the tap-through breakdown carries that.
const FORMATS: Record<
  Exclude<TimeFormat, "auto">,
  Intl.DateTimeFormatOptions
> = {
  datetime: {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  date: { weekday: "short", month: "short", day: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
};

// Breakdown rows show a full date + time + zone so the instant is unambiguous.
const DETAIL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

// Reused for both the inline countdown and the breakdown header.
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function asFormat(value: unknown): TimeFormat {
  return value === "datetime" || value === "date" || value === "time"
    ? value
    : "auto";
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

// YYYY-MM-DD in a given zone, for "is it the same calendar day" checks.
function dayKey(date: Date, zone?: string): string {
  return (
    formatIn(
      date,
      { year: "numeric", month: "2-digit", day: "2-digit" },
      zone,
    ) ?? date.toISOString().slice(0, 10)
  );
}

// "in 38 minutes" / "in 3 hours" / "tomorrow" — picks the coarsest fitting
// unit. Null past a week, where the absolute date already says enough.
function relativeLabel(diffMs: number): string | null {
  const abs = Math.abs(diffMs);
  if (abs >= 7 * DAY_MS) return null;
  if (abs < HOUR_MS)
    return rtf.format(Math.round(diffMs / MINUTE_MS) || 1, "minute");
  if (abs < DAY_MS) return rtf.format(Math.round(diffMs / HOUR_MS), "hour");
  return rtf.format(Math.round(diffMs / DAY_MS), "day");
}

// The concise inline label: a countdown when kickoff is within the hour, just
// the time when it's later today, otherwise a short date + time.
function autoLabel(date: Date, now: number, zone?: string): string | null {
  const diffMs = date.getTime() - now;
  if (diffMs > 0 && diffMs < HOUR_MS)
    return rtf.format(Math.max(1, Math.round(diffMs / MINUTE_MS)), "minute");
  const sameDay = dayKey(date, zone) === dayKey(new Date(now), zone);
  return formatIn(date, sameDay ? FORMATS.time : FORMATS.datetime, zone);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

// Tap-through detail: how long until kickoff, then the full instant across the
// shown zone, the reader's own device zone, and UTC.
function ZoneBreakdown({ date, tz }: { date: Date; tz?: string }) {
  const [now] = useState(() => Date.now());
  const relative = relativeLabel(date.getTime() - now);
  const local = readerZone();
  const primary = tz || local;
  const zones = [primary, local, "UTC"].filter(
    (zone, i, all) => all.indexOf(zone) === i,
  );
  return (
    <div className="flex flex-col gap-2">
      {relative && (
        <div className="text-xs font-medium text-foreground">
          {capitalize(relative)}
        </div>
      )}
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
    </div>
  );
}

/**
 * Renders a UTC instant as a concise, locale-aware label. The agent emits
 * `<local-time iso="...Z">fallback</local-time>` with the raw UTC instant it
 * already has, and this component does the conversion and phrasing — so the
 * model never does timezone math or writes a countdown (it got both wrong).
 *
 * By default (`format="auto"`) it shows a relative countdown when kickoff is
 * near, just the time when it's later today, or a short date otherwise; the
 * reader taps to see the full instant across zones. The agent can pass
 * `tz="Europe/Madrid"` to target a specific zone instead of the reader's.
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
    if (!date) return;
    const f = asFormat(format);
    setDisplay(
      f === "auto"
        ? autoLabel(date, Date.now(), tz)
        : formatIn(date, FORMATS[f], tz),
    );
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

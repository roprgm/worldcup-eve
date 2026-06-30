"use client";

import { cn } from "cnfast";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";

type TimeFormat = "auto" | "datetime" | "date" | "time";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: "long" };
const DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const DATE_YEAR: Intl.DateTimeFormatOptions = { year: "numeric", ...DATE };

// Any instant works — the locale's date↔time connector word doesn't depend on
// the actual value, only on the language.
const CONNECTOR_SAMPLE = new Date("2026-01-01T15:00:00Z");

// Explicit inline presets the agent can force via the `format` attribute.
const FORMATS: Record<
  Exclude<TimeFormat, "auto">,
  Intl.DateTimeFormatOptions
> = {
  datetime: { ...DATE, ...TIME },
  date: { weekday: "short", ...DATE },
  time: TIME,
};

// Breakdown rows show a full date + time + zone so the instant is unambiguous.
const DETAIL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  ...TIME,
  timeZoneName: "short",
};

function asFormat(value: unknown): TimeFormat {
  return value === "datetime" || value === "date" || value === "time"
    ? value
    : "auto";
}

// The agent can pass a junk locale/zone; validate so a bad value silently falls
// back to the reader's own rather than throwing.
function safeLocale(locale?: string): string | undefined {
  if (!locale) return undefined;
  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return undefined;
  }
}

function safeZone(zone?: string): string | undefined {
  if (!zone) return undefined;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

// IANA id → human label: "America/Mexico_City" → "Mexico City", "UTC" → "UTC".
function zoneLabel(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

function formatIn(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  locale?: string,
  zone?: string,
): string {
  const opts = zone ? { ...options, timeZone: zone } : options;
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Calendar-day index of an instant in a zone (always latin digits, locale-
// independent) so we can tell today / tomorrow / this week apart.
function zonedDayNumber(date: Date, zone?: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Math.floor(
    Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS,
  );
}

function zonedYear(date: Date, zone?: string): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
    }).format(date),
  );
}

function relative(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale?: string,
): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    value,
    unit,
  );
}

// The locale's word joining a date to a time — " at " (en), " a las " (es),
// " às " (pt), " à " (fr) — pulled from a long/short pattern. Falls back to a
// plain space when the locale joins them without a word.
function connector(locale?: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  }).formatToParts(CONNECTOR_SAMPLE);
  const timeIndex = parts.findIndex(
    (p) => p.type === "hour" || p.type === "dayPeriod",
  );
  const before = timeIndex > 0 ? parts[timeIndex - 1] : undefined;
  return before?.type === "literal" ? before.value : " ";
}

// A self-contained, natural time phrase in the reader's (or `locale`'s)
// language, so the agent drops it in without any connector of its own:
//   < 1h away  → "in 38 minutes"
//   today      → "today at 2:00 PM"
//   ±1 day     → "tomorrow at 2:00 PM" / "yesterday at 2:00 PM"
//   this week  → "Thursday at 12:30 PM"
//   otherwise  → "Jul 2 at 2:00 PM" (with year when it differs)
function autoLabel(
  date: Date,
  now: number,
  locale?: string,
  zone?: string,
): string {
  const diffMs = date.getTime() - now;
  if (diffMs > 0 && diffMs < HOUR_MS)
    return relative(
      Math.max(1, Math.round(diffMs / MINUTE_MS)),
      "minute",
      locale,
    );

  const time = formatIn(date, TIME, locale, zone);
  const at = connector(locale);
  const dayDiff =
    zonedDayNumber(date, zone) - zonedDayNumber(new Date(now), zone);
  if (dayDiff >= -1 && dayDiff <= 1)
    return `${relative(dayDiff, "day", locale)}${at}${time}`;
  if (dayDiff >= 2 && dayDiff <= 6)
    return `${formatIn(date, WEEKDAY, locale, zone)}${at}${time}`;

  const sameYear = zonedYear(date, zone) === zonedYear(new Date(now), zone);
  return `${formatIn(date, sameYear ? DATE : DATE_YEAR, locale, zone)}${at}${time}`;
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

// Tap-through detail: the same label shown inline, then the full instant across
// the shown zone, the reader's own device zone, and UTC.
function ZoneBreakdown({
  title,
  date,
  locale,
  zone,
}: {
  title: string;
  date: Date;
  locale?: string;
  zone?: string;
}) {
  const local = readerZone();
  const primary = zone || local;
  const zones = [primary, local, "UTC"].filter(
    (z, i, all) => all.indexOf(z) === i,
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="flex flex-col gap-1.5">
        {zones.map((z) => (
          <ZoneRow
            key={z}
            zone={z}
            value={formatIn(date, DETAIL_FORMAT, locale, z)}
            primary={z === primary}
          />
        ))}
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
 * Defaults to the reader's language and zone. `tz` overrides the zone (for "what
 * time in Madrid?") and `lang` the language; both validated, falling back to the
 * reader's on junk. A tap reveals the same label plus the full instant per zone.
 *
 * Formatting is deferred to a mount effect: the server has no reader time zone,
 * so the UTC fallback renders first (matching SSR, degrading without JS) and the
 * localized value swaps in on the client.
 */
export function LocalTime({
  iso,
  format,
  tz,
  lang,
  children,
}: {
  iso?: string;
  format?: string;
  tz?: string;
  lang?: string;
  children?: ReactNode;
}) {
  const date = useMemo(() => {
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [iso]);
  const locale = useMemo(() => safeLocale(lang), [lang]);
  const zone = useMemo(() => safeZone(tz), [tz]);

  const [display, setDisplay] = useState<string | null>(null);
  useEffect(() => {
    if (!date) return;
    const f = asFormat(format);
    setDisplay(
      f === "auto"
        ? autoLabel(date, Date.now(), locale, zone)
        : formatIn(date, FORMATS[f], locale, zone),
    );
  }, [date, format, locale, zone]);

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
        {display && (
          <ZoneBreakdown
            title={display}
            date={date}
            locale={locale}
            zone={zone}
          />
        )}
      </Popover>
    </>
  );
}

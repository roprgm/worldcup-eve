"use client";

import { cn } from "cnfast";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";

const DAY_MS = 24 * 60 * 60 * 1000;

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: "long" };
const DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const DATE_YEAR: Intl.DateTimeFormatOptions = { year: "numeric", ...DATE };

// Tap-through rows add the zone name so the instant is unambiguous.
const DETAIL: Intl.DateTimeFormatOptions = {
  weekday: "short",
  ...DATE,
  ...TIME,
  timeZoneName: "short",
};

// Any instant works — the locale's date↔time connector word depends only on the
// language, not the value.
const CONNECTOR_SAMPLE = new Date("2026-01-01T15:00:00Z");

// The agent can pass a junk locale/zone; validate so a bad value falls back to
// the reader's own rather than throwing.
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

// Calendar-day index of an instant in a zone (latin digits, locale-independent)
// so today / tomorrow / this week can be told apart.
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

function sameZonedYear(a: Date, b: Date, zone?: string): boolean {
  const year = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
    }).format(d);
  return year(a) === year(b);
}

// The locale's word joining a date to a time (" at " in English, " a las " in
// Spanish), from a long/short pattern. Falls back to a space.
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

// A complete, natural phrase in the reader's zone and language, so the agent
// drops the tag in and adds nothing: the day word for today/tomorrow/yesterday
// ("hoy a las 18:00"), a weekday within the week ("martes a las 18:00"), else a
// date ("5 jul a las 18:00", with year when it differs).
function phrase(
  date: Date,
  now: number,
  locale?: string,
  zone?: string,
): string {
  const time = formatIn(date, TIME, locale, zone);
  const at = connector(locale);
  const dayDiff =
    zonedDayNumber(date, zone) - zonedDayNumber(new Date(now), zone);
  if (dayDiff >= -1 && dayDiff <= 1) {
    const day = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      dayDiff,
      "day",
    );
    return `${day}${at}${time}`;
  }
  if (dayDiff >= 2 && dayDiff <= 6)
    return `${formatIn(date, WEEKDAY, locale, zone)}${at}${time}`;
  const opts = sameZonedYear(date, new Date(now), zone) ? DATE : DATE_YEAR;
  return `${formatIn(date, opts, locale, zone)}${at}${time}`;
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

// Tap-through detail: the full instant across the shown zone, the reader's own
// device zone, and UTC.
function ZoneBreakdown({
  date,
  locale,
  zone,
}: {
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
    <div className="flex flex-col gap-1.5">
      {zones.map((z) => (
        <ZoneRow
          key={z}
          zone={z}
          value={formatIn(date, DETAIL, locale, z)}
          primary={z === primary}
        />
      ))}
    </div>
  );
}

/**
 * Renders a UTC instant as a complete, natural date/time phrase in the reader's
 * own zone and language — "hoy a las 18:00", "martes a las 18:00", "5 jul a las
 * 18:00". The agent emits `<local-time iso="...Z" lang="...">fallback</...>` and
 * drops it in as the whole date/time, adding no day word or connector of its own;
 * the component does the conversion and phrasing, so the model never does
 * timezone math (it got it wrong). `tz` overrides the zone (venue / a named
 * place) and `lang` the language; both validated, falling back to the reader's.
 * A tap shows the full instant across zones.
 *
 * Formatting is deferred to a mount effect: the server has no reader time zone,
 * so the UTC fallback renders first (matching SSR, degrading without JS) and the
 * localized value swaps in on the client.
 */
export function LocalTime({
  iso,
  tz,
  lang,
  children,
}: {
  iso?: string;
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
    if (date) setDisplay(phrase(date, Date.now(), locale, zone));
  }, [date, locale, zone]);

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
        <ZoneBreakdown date={date} locale={locale} zone={zone} />
      </Popover>
    </>
  );
}

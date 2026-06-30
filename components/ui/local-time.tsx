"use client";

import { cn } from "cnfast";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";

// What kind of phrase to render. The agent picks the one that matches the
// user's question; every mode produces a complete, self-contained phrase in the
// reader's language, so the agent never adds a connector of its own.
type Mode = "datetime" | "relative" | "time" | "date";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: "long" };
const DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const DATE_YEAR: Intl.DateTimeFormatOptions = { year: "numeric", ...DATE };
const WEEKDAY_DATE: Intl.DateTimeFormatOptions = { weekday: "short", ...DATE };
const WEEKDAY_DATE_YEAR: Intl.DateTimeFormatOptions = {
  year: "numeric",
  ...WEEKDAY_DATE,
};

// Breakdown rows show a full date + time + zone so the instant is unambiguous.
const DETAIL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  ...TIME,
  timeZoneName: "short",
};

// Any instant works — the locale's date↔time connector word doesn't depend on
// the actual value, only on the language.
const CONNECTOR_SAMPLE = new Date("2026-01-01T15:00:00Z");

function asMode(value: unknown): Mode {
  return value === "relative" || value === "time" || value === "date"
    ? value
    : "datetime";
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

function sameZonedYear(a: Date, b: Date, zone?: string): boolean {
  const year = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
    }).format(d);
  return year(a) === year(b);
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

// A duration from now in the coarsest fitting unit: "in 38 minutes",
// "in 3 days", "tomorrow", "2 weeks ago". Zone-independent.
function relativePhrase(diffMs: number, locale?: string): string {
  const abs = Math.abs(diffMs);
  if (abs < HOUR_MS)
    return relative(Math.round(diffMs / MINUTE_MS) || 1, "minute", locale);
  if (abs < DAY_MS)
    return relative(Math.round(diffMs / HOUR_MS), "hour", locale);
  if (abs < WEEK_MS)
    return relative(Math.round(diffMs / DAY_MS), "day", locale);
  if (abs < MONTH_MS)
    return relative(Math.round(diffMs / WEEK_MS), "week", locale);
  if (abs < YEAR_MS)
    return relative(Math.round(diffMs / MONTH_MS), "month", locale);
  return relative(Math.round(diffMs / YEAR_MS), "year", locale);
}

// The locale's word joining a date to a time (e.g. " at " in English), pulled
// from a long/short pattern. Falls back to a plain space when the locale joins
// them without a word.
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

// "at 1:00 PM" / "a las 13:00" — clock time with the locale's connector, so it
// drops into a sentence on its own.
function timePhrase(date: Date, locale?: string, zone?: string): string {
  return `${connector(locale).trimStart()}${formatIn(date, TIME, locale, zone)}`;
}

// "Sun, Jul 12" — a date, with the year only when it differs from now.
function datePhrase(
  date: Date,
  now: number,
  locale?: string,
  zone?: string,
): string {
  const opts = sameZonedYear(date, new Date(now), zone)
    ? WEEKDAY_DATE
    : WEEKDAY_DATE_YEAR;
  return formatIn(date, opts, locale, zone);
}

// The friendly "when": a relative countdown when it's very soon, otherwise a
// day word / weekday / date joined to the time — "today at 6:00 PM",
// "Thursday at 12:30 PM", "Jul 20 at 1:00 PM".
function datetimePhrase(
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

  const opts = sameZonedYear(date, new Date(now), zone) ? DATE : DATE_YEAR;
  return `${formatIn(date, opts, locale, zone)}${at}${time}`;
}

function phraseFor(
  mode: Mode,
  date: Date,
  now: number,
  locale?: string,
  zone?: string,
): string {
  switch (mode) {
    case "relative":
      return relativePhrase(date.getTime() - now, locale);
    case "time":
      return timePhrase(date, locale, zone);
    case "date":
      return datePhrase(date, now, locale, zone);
    default:
      return datetimePhrase(date, now, locale, zone);
  }
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
          value={formatIn(date, DETAIL_FORMAT, locale, z)}
          primary={z === primary}
        />
      ))}
    </div>
  );
}

/**
 * Renders a UTC instant as a localized phrase. The agent emits
 * `<local-time iso="...Z" mode="..." lang="...">fallback</local-time>` with the
 * raw UTC instant it already has; this component does the conversion and
 * phrasing, so the model never does timezone math itself (it got it wrong).
 *
 * `mode` selects the phrasing — "datetime" (default, the friendly "when"),
 * "relative" (a duration like "in 3 days"), "time", or "date". Every mode is a
 * complete, self-contained phrase, so the agent places the tag as the whole time
 * expression with no preposition of its own. `tz` and `lang` override the zone
 * and language (validated, falling back to the reader's). A tap shows the full
 * instant across zones.
 *
 * Formatting is deferred to a mount effect: the server has no reader time zone,
 * so the UTC fallback renders first (matching SSR, degrading without JS) and the
 * localized value swaps in on the client.
 */
export function LocalTime({
  iso,
  mode,
  tz,
  lang,
  children,
}: {
  iso?: string;
  mode?: string;
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
    if (date)
      setDisplay(phraseFor(asMode(mode), date, Date.now(), locale, zone));
  }, [date, mode, locale, zone]);

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

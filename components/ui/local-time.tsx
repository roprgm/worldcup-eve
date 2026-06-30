"use client";

import { cn } from "cnfast";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";

// One rendered format: weekday, date and time in the reader's zone. The agent
// phrases its sentence around this; it doesn't add connectors of its own.
const FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

// Tap-through rows add the zone name so the instant is unambiguous.
const DETAIL: Intl.DateTimeFormatOptions = { ...FORMAT, timeZoneName: "short" };

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
 * Renders a UTC instant as a date + time in the reader's own zone and language.
 * The agent emits `<local-time iso="...Z" lang="...">fallback</local-time>` with
 * the raw UTC instant and phrases its sentence around the tag; the component just
 * converts and formats, so the model never does timezone math (it got it wrong).
 * `tz` overrides the zone (venue / a named place) and `lang` the language; both
 * validated, falling back to the reader's. A tap shows the instant across zones.
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
    if (date) setDisplay(formatIn(date, FORMAT, locale, zone));
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

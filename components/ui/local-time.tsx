"use client";

import { useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";

const DETAIL: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

// "America/Mexico_City" → "Mexico City", "UTC" → "UTC".
function zoneLabel(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function dayInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// "Today"/"Tomorrow"/"Yesterday" if `date` falls within a day of now on that
// zone's own wall-clock calendar, else null (the date itself carries the day).
function relativeDay(date: Date, timeZone: string): string | null {
  const days =
    (Date.parse(dayInZone(date, timeZone)) -
      Date.parse(dayInZone(new Date(), timeZone))) /
    86_400_000;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return null;
}

// The tag's default visible text: "Today, 3:00 PM" close to now, else
// "Fri, Jul 3, 3:00 PM" — computed straight from the instant, so it can never
// drift from what the popover's own breakdown shows.
function displayText(date: Date, timeZone: string): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const relative = relativeDay(date, timeZone);
  if (relative) return `${relative}, ${time}`;
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  return `${day}, ${time}`;
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

/** Renders a kickoff instant localized to a time zone — the reader's own by
 *  default, or an explicit `tz` (a venue or a place the user asked about).
 *  Fully self-computing: the agent only ever passes `iso` (and `tz` when the
 *  user asked about a specific place) — there's no text to hand-write, so the
 *  visible time can never drift from what a tap reveals. */
export function LocalTime({ iso, tz }: { iso?: string; tz?: string }) {
  const date = useMemo(() => {
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [iso]);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!date) return iso ? <span>{iso}</span> : null;
  const zone = tz ?? readerZone();

  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor((cur) => (cur ? null : e.currentTarget))}
        className="cursor-pointer underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 hover:decoration-foreground"
      >
        <time dateTime={iso}>{displayText(date, zone)}</time>
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

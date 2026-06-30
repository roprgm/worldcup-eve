"use client";

import { type ReactNode, useEffect, useState } from "react";

type TimeFormat = "datetime" | "date" | "time";

// Locale-aware presets. The reader's runtime fills in language and time zone.
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

function asFormat(value: unknown): TimeFormat {
  return value === "date" || value === "time" ? value : "datetime";
}

/**
 * Renders a UTC instant in the reader's own locale and time zone. The agent
 * emits `<local-time iso="...Z">fallback</local-time>` with the raw UTC instant
 * it already has, and the browser does the conversion here — so the model never
 * has to do timezone math (it kept getting that wrong).
 *
 * Formatting is deferred to a mount effect: the server has no reader time zone,
 * so the UTC fallback renders first (matching SSR, degrading without JS) and the
 * localized value swaps in on the client.
 */
export function LocalTime({
  iso,
  format,
  children,
}: {
  iso?: string;
  format?: string;
  children?: ReactNode;
}) {
  const [localized, setLocalized] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) return;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return;
    setLocalized(
      new Intl.DateTimeFormat(undefined, FORMATS[asFormat(format)]).format(
        date,
      ),
    );
  }, [iso, format]);

  if (!iso) return <>{children}</>;
  return <time dateTime={iso}>{localized ?? children}</time>;
}

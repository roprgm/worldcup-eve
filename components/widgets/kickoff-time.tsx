"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";

import { LocalTime } from "@/components/ui/local-time";

// Kickoff shown in the reader's own zone, e.g. "Jul 22, 12hs" / "Jul 22, 12:30hs".
function localKickoff(iso: string): string {
  const date = new Date(iso);
  return format(date, date.getMinutes() === 0 ? "MMM d, H'hs'" : "MMM d, H:mm'hs'");
}

/** Kickoff label for the match header: the reader's local time, tappable to
 *  reveal the instant across zones via {@link LocalTime}. `fallback` is a
 *  server-formatted label rendered until mount so SSR and the first client
 *  render agree; after mount we swap in the reader's own zone. */
export function KickoffTime({ iso, fallback }: { iso: string; fallback?: string }) {
  const [label, setLabel] = useState(fallback ?? "");

  useEffect(() => {
    setLabel(localKickoff(iso));
  }, [iso]);

  return <LocalTime iso={iso}>{label}</LocalTime>;
}

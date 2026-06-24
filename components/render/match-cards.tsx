"use client";

import { JSONUIProvider, Renderer } from "@json-render/react";
import { useEffect, useMemo, useState } from "react";
import {
  hasLiveMatch,
  matchCardIds,
  matchResultsSpec,
} from "@/components/render/match-card";
import { registry } from "@/components/render/registry";

// How often to refresh while a match is live. The endpoint is cached ~15s
// server-side (+ a short CDN window), so polling faster wouldn't gain freshness.
const POLL_MS = 25_000;

/**
 * Renders match cards from a `get_match_results` payload and keeps them live:
 * while any match in the payload is in progress, it polls `/api/matches` for the
 * same match ids and re-renders. Polling stops once every match is final (or the
 * tab is hidden), so finished and scheduled cards stay completely static.
 */
export function MatchCards({ initialOutput }: { initialOutput: unknown }) {
  const [output, setOutput] = useState<unknown>(initialOutput);

  const spec = useMemo(() => matchResultsSpec(output), [output]);
  const idsKey = useMemo(() => matchCardIds(output).join(","), [output]);
  const live = useMemo(() => hasLiveMatch(output), [output]);

  // Stable across re-renders unless the live state or the match set changes, so
  // the polling effect isn't torn down on every score update.
  const pollKey = live ? idsKey : "";

  useEffect(() => {
    if (!pollKey) return;

    let cancelled = false;

    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/matches?ids=${pollKey}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const next: unknown = await res.json();
        const results = (next as { results?: unknown } | null)?.results;
        if (!cancelled && Array.isArray(results) && results.length > 0) {
          setOutput(next);
        }
      } catch {
        // Keep the last good data on a transient failure.
      }
    };

    // Refresh immediately (covers chats restored from storage), then on a timer.
    void poll();
    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollKey]);

  if (!spec) return null;
  return (
    <JSONUIProvider registry={registry}>
      <Renderer spec={spec} registry={registry} />
    </JSONUIProvider>
  );
}

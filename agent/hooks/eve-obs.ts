import { defineHook } from "eve/hooks";
import { waitUntil } from "@vercel/functions";

/**
 * Pushes session activity to the eve-obs dashboard.
 *
 * After every completed turn (and on session failure) it notifies eve-obs,
 * which pulls the session's full event stream back through this app's own
 * observability endpoints — the transcript is never re-encoded here, so the
 * two projects only share one tiny notification shape.
 *
 * Configuration (both unset = the hook is a no-op):
 *   EVE_OBS_URL   — base URL of the eve-obs deployment
 *   EVE_OBS_TOKEN — bearer token; must match EVE_OBS_INGEST_TOKEN on eve-obs
 */
function notifyEveObs(sessionId: string): void {
  const base = process.env.EVE_OBS_URL;
  if (!base) return;
  const token = process.env.EVE_OBS_TOKEN;

  const request = fetch(`${base.replace(/\/$/, "")}/api/sync/eve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ sessionIds: [sessionId] }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    // Observability must never fail a turn — drop the notification.
  });

  try {
    waitUntil(request);
  } catch {
    // Outside a Vercel function context (local dev): fire and forget.
  }
}

export default defineHook({
  events: {
    "turn.completed"(_event, ctx) {
      notifyEveObs(ctx.session.id);
    },
    "session.failed"(_event, ctx) {
      notifyEveObs(ctx.session.id);
    },
  },
});

import { defineHook, type HookContext } from "eve/hooks";

/**
 * Notifies eve-obs after every completed turn (and on session failure);
 * eve-obs pulls the session's event stream back through this app's
 * observability routes and stores it. No-op unless EVE_OBS_URL and
 * EVE_OBS_TOKEN are set.
 *
 * The request is awaited because the workflow runtime suspends once the
 * handler resolves — a dangling fetch would never complete. The user's reply
 * is already delivered by then, so this adds no visible latency. Failures
 * only log: observability must never fail a turn.
 */
async function notifyEveObs(_event: unknown, ctx: HookContext): Promise<void> {
  const { EVE_OBS_URL, EVE_OBS_TOKEN } = process.env;
  if (!EVE_OBS_URL || !EVE_OBS_TOKEN) return;

  try {
    const response = await fetch(new URL("/api/sync/eve", EVE_OBS_URL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${EVE_OBS_TOKEN}`,
      },
      body: JSON.stringify({ sessionIds: [ctx.session.id] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.warn(`[eve-obs] notify ${ctx.session.id}: ${response.status}`);
    }
  } catch (error) {
    console.warn(`[eve-obs] notify ${ctx.session.id}:`, error);
  }
}

export default defineHook({
  events: {
    "turn.completed": notifyEveObs,
    "session.failed": notifyEveObs,
  },
});

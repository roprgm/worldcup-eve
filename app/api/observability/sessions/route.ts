/**
 * Copy into your eve project as: app/api/observability/sessions/route.ts
 *
 * Lists top-level conversation runs so eve-obs can enumerate what to
 * back-fill; session *content* needs no custom route — eve serves it natively
 * at /eve/v1/session/:id/stream. Runs inside the deployment, where the
 * Workflow runtime API is available.
 *
 * Set OBSERVABILITY_TOKEN in the project's env — this exposes conversation ids.
 */
import { getWorld } from "workflow/runtime";

export const dynamic = "force-dynamic";

function requireAuth(req: Request): Response | null {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.OBSERVABILITY_TOKEN || token !== process.env.OBSERVABILITY_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const unauthorized = requireAuth(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const world = await getWorld();
  // Each eve conversation is one run of the session entry workflow; turns and
  // subagents run under different workflow names. On deployments where eve
  // also stamps executionContext ($eve.type etc.), title/trigger come along.
  const page = await world.runs.list({
    workflowName: "workflow//eve//workflowEntry",
    pagination: { limit, cursor },
    resolveData: "none",
  });

  const sessions = page.data.map((run) => ({
    sessionId: run.runId,
    title: run.executionContext?.["$eve.title"] ?? null,
    trigger: run.executionContext?.["$eve.trigger"] ?? null,
    status: run.status,
    createdAt: run.createdAt,
  }));

  return Response.json({
    sessions,
    nextCursor: page.cursor,
    hasMore: page.hasMore,
  });
}

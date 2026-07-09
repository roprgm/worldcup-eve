/**
 * Copy into your eve project as: app/api/observability/sessions/[sessionId]/route.ts
 *
 * Token-gated access to one session's NDJSON event log. eve already serves
 * this natively at /eve/v1/session/:id/stream — use this route when that
 * endpoint isn't reachable from outside (Vercel deployment protection, or
 * you want everything behind one OBSERVABILITY_TOKEN). It proxies the app's
 * own stream endpoint, forwarding the protection-bypass secret when Vercel
 * provides one, and returns the byte-identical NDJSON.
 */
export const dynamic = "force-dynamic";

function requireAuth(req: Request): Response | null {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.OBSERVABILITY_TOKEN || token !== process.env.OBSERVABILITY_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const unauthorized = requireAuth(req);
  if (unauthorized) return unauthorized;

  const { sessionId } = await params;
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const upstream = await fetch(
    new URL(`/eve/v1/session/${sessionId}/stream?startIndex=0`, req.url),
    { headers: bypass ? { "x-vercel-protection-bypass": bypass } : {} }
  );
  if (!upstream.ok) {
    return new Response(`eve stream responded ${upstream.status}`, { status: upstream.status });
  }
  return new Response(upstream.body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });
}

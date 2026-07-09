import { NextResponse } from "next/server";

import { readJson, writeJson } from "@/lib/storage/blob";

export const dynamic = "force-dynamic";

// Chat ids ride in the URL and become a blob key, so keep them to the charset
// our generator emits and reject anything that could escape the key namespace.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const blobKey = (id: string) => `chat/${id}.json`;

type RouteContext = { params: Promise<{ id: string }> };

/** The eve session cursor saved for `id`, or 404 when none is stored yet. The
 *  conversation itself lives in eve's durable session — we only keep the handle
 *  ({ sessionId, continuationToken, streamIndex }) to resume it. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!ID_RE.test(id))
    return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const cursor = await readJson(blobKey(id));
  if (!cursor)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(cursor);
}

/** Upsert the session cursor for `id`. The body is the small cursor object, not
 *  the event log; a stale write only breaks its own chat's resume. */
export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!ID_RE.test(id))
    return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const cursor = await request.json().catch(() => null);
  if (!cursor || typeof cursor !== "object" || !("sessionId" in cursor))
    return NextResponse.json({ error: "invalid cursor" }, { status: 400 });

  await writeJson(blobKey(id), cursor);
  return NextResponse.json({ ok: true });
}

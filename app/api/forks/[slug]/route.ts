import { NextResponse } from "next/server";

import { type ForkSeed, isValidSlug, saveFork } from "@/lib/forks/store";

export const dynamic = "force-dynamic";

// Creating shareable forks is an admin action, open in local dev and Vercel
// preview but closed in real production, where this route only ever reads
// (see app/fork/[slug]). VERCEL_ENV is "production" only on the prod deployment.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  let body: Partial<ForkSeed>;
  try {
    body = (await request.json()) as Partial<ForkSeed>;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!Array.isArray(body.events) || typeof body.transcript !== "string") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    await saveFork(slug, {
      events: body.events,
      transcript: body.transcript,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Surface the real cause (e.g. missing BLOB_READ_WRITE_TOKEN / no Blob
    // store connected). Safe to expose: this route is closed in production.
    const detail = error instanceof Error ? error.message : "save failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  return NextResponse.json({ url: `/fork/${slug}` });
}

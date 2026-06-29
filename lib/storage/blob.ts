// A tiny typed wrapper over Vercel Blob for private JSON. Domain-free: it knows
// nothing about predictions. When `BLOB_READ_WRITE_TOKEN` is unset (local dev,
// first deploy) every call no-ops — reads return null, writes are skipped — so
// the app runs without storage instead of throwing.

import { get, put } from "@vercel/blob";

const enabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Parse the private JSON blob at `pathname`, or null when absent/disabled. */
export async function readJson<T>(pathname: string): Promise<T | null> {
  if (!enabled()) return null;
  try {
    const res = await get(pathname, { access: "private" });
    if (!res?.stream) return null; // missing, or a 304 with no body
    return (await new Response(res.stream).json()) as T;
  } catch {
    // missing key or a transient error — the caller falls back, never crashes
    return null;
  }
}

/** Overwrite the private JSON blob at `pathname`. Logs and continues on error so
 *  a failed write never takes down the scheduled job that triggered it. */
export async function writeJson(
  pathname: string,
  data: unknown,
): Promise<void> {
  if (!enabled()) return;
  try {
    await put(pathname, JSON.stringify(data), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    });
  } catch (error) {
    console.error(`blob write failed for ${pathname}:`, error);
  }
}

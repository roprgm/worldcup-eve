// A typed wrapper over Vercel Blob for private JSON. With no credentials (plain
// local dev, first deploy) every call no-ops, so the app runs without storage.

import { get, put } from "@vercel/blob";

// A static read/write token, or OIDC (the runtime's token + connected store id).
const enabled = () =>
  Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  );

/** Parse the private JSON blob at `pathname`, or null when absent/disabled. */
export async function readJson<T>(pathname: string): Promise<T | null> {
  if (!enabled()) return null;
  try {
    const res = await get(pathname, { access: "private" });
    if (!res?.stream) return null;
    return (await new Response(res.stream).json()) as T;
  } catch {
    return null;
  }
}

/** Overwrite the private JSON blob at `pathname`; logs and continues on error. */
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

import { get, put } from "@vercel/blob";
import type { EveMessageData, UseEveAgentHelpers } from "eve/react";

// The raw eve stream events (used to re-render the prior conversation) plus a
// plain-text transcript the forked session injects as model context each turn.
export type ForkSeed = {
  events: UseEveAgentHelpers<EveMessageData>["events"];
  transcript: string;
  createdAt: string;
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

const pathname = (slug: string) => `forks/${slug}.json`;

// Private store: blobs aren't reachable by URL, so reads go through the SDK
// (server-side, with the read-write token) rather than a public fetch.
export async function saveFork(slug: string, seed: ForkSeed): Promise<void> {
  await put(pathname(slug), JSON.stringify(seed), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function loadFork(slug: string): Promise<ForkSeed | null> {
  if (!isValidSlug(slug)) return null;
  const result = await get(pathname(slug), { access: "private" });
  if (result?.statusCode !== 200) return null;
  return (await new Response(result.stream).json()) as ForkSeed;
}

// Generate shareable forks programmatically: run each scripted conversation
// against a live agent, capture its stream events, and persist a fork seed.
//
// Requires a running agent (e.g. `bun run dev`) and BLOB_READ_WRITE_TOKEN +
// AI_GATEWAY_API_KEY in the environment (Bun auto-loads .env.local).
//
//   bun run lib/forks/generate.ts
//   EVE_HOST=http://localhost:3000 bun run lib/forks/generate.ts

import { Client, type HandleMessageStreamEvent } from "eve/client";
import { type ForkSeed, isValidSlug, saveFork } from "./store";

// Each fork is a slug plus the user turns that seed the conversation. The
// assistant's replies come from the live agent, so they stay current.
const FORKS: { slug: string; messages: string[] }[] = [
  { slug: "today", messages: ["Which matches are playing today?"] },
  { slug: "best-thirds", messages: ["Who are the best third-placed teams?"] },
  {
    slug: "argentina",
    messages: [
      "Where did Argentina play their last match?",
      "Who scored in that match?",
    ],
  },
];

const HOST = process.env.EVE_HOST ?? "http://localhost:3000";

async function generate(messages: string[]): Promise<ForkSeed> {
  const session = new Client({ host: HOST }).session();
  const events: HandleMessageStreamEvent[] = [];
  const lines: string[] = [];

  for (const message of messages) {
    const result = await (await session.send(message)).result();
    events.push(...result.events);
    lines.push(`User: ${message}`);
    if (result.message) lines.push(`Assistant: ${result.message}`);
  }

  return {
    events,
    transcript: lines.join("\n\n"),
    createdAt: new Date().toISOString(),
  };
}

for (const { slug, messages } of FORKS) {
  if (!isValidSlug(slug)) {
    console.error(`✗ ${slug}: invalid slug, skipping`);
    continue;
  }
  try {
    console.log(`• ${slug}: running ${messages.length} turn(s)…`);
    await saveFork(slug, await generate(messages));
    console.log(`✓ ${slug}: published at /fork/${slug}`);
  } catch (error) {
    console.error(`✗ ${slug}:`, error instanceof Error ? error.message : error);
  }
}

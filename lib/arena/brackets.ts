// Human-made bracket predictions, stored in Neon alongside the model runs but in
// their own table (`arena_brackets`). Just the picks — no model, tokens or
// reasoning — shared under an unguessable id, read-only.

import type { TeamCode } from "./board";
import { ensureSchema, sql } from "./db";

/** A shareable set of picks: knockout match number → its guessed winner. */
export type Picks = Record<number, TeamCode>;

// Share ids are 12 hex chars (48 random bits) — plenty for unguessable links.
const ID_RE = /^[a-f0-9]{12}$/;

/** Store a bracket under a fresh share id and return it, or null when storage is
 *  unavailable. */
export async function saveBracket(picks: Picks): Promise<string | null> {
  if (!sql) return null;
  await ensureSchema();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await sql`
    insert into arena_brackets (id, picks)
    values (${id}, ${JSON.stringify(picks)}::jsonb)
  `;
  return id;
}

/** Read the picks stored under a share id, or null for a malformed id or an
 *  absent row. */
export async function readBracket(id: string): Promise<Picks | null> {
  if (!sql || !ID_RE.test(id)) return null;
  await ensureSchema();
  const rows = await sql`select picks from arena_brackets where id = ${id}`;
  return (rows[0]?.picks as Picks) ?? null;
}

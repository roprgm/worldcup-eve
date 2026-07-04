// Human-made bracket predictions, stored in Neon alongside the model runs but in
// their own table (`arena_brackets`). Just a name and the picks — no model,
// tokens or reasoning — shared under an unguessable id, read-only.

import type { TeamCode } from "./board";
import { ensureSchema, sql } from "./db";

/** A shareable set of picks: knockout match number → its guessed winner. */
export type Picks = Record<number, TeamCode>;

export interface HumanBracket {
  name: string | null;
  picks: Picks;
}

// Share ids are 12 hex chars (48 random bits) — plenty for unguessable links.
const ID_RE = /^[a-f0-9]{12}$/;

/** Store a bracket under a fresh share id and return it, or null when storage is
 *  unavailable. The name is what later ranks it on a human leaderboard. */
export async function saveBracket(
  picks: Picks,
  name: string | null,
): Promise<string | null> {
  if (!sql) return null;
  await ensureSchema();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await sql`
    insert into arena_brackets (id, name, picks)
    values (${id}, ${name}, ${JSON.stringify(picks)}::jsonb)
  `;
  return id;
}

/** Read the name and picks stored under a share id, or null for a malformed id
 *  or an absent row. */
export async function readBracket(id: string): Promise<HumanBracket | null> {
  if (!sql || !ID_RE.test(id)) return null;
  await ensureSchema();
  const rows =
    await sql`select name, picks from arena_brackets where id = ${id}`;
  const row = rows[0];
  if (!row) return null;
  return { name: (row.name as string) ?? null, picks: row.picks as Picks };
}

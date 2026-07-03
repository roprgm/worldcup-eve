import type { TeamCode } from "@/components/circular-bracket";
import { readJson } from "@/lib/storage/blob";

/** A shareable set of picks: knockout match number → its guessed winner. */
export type Picks = Record<number, TeamCode>;

// Share ids are 12 hex chars; the blob lives under this key.
const ID_RE = /^[a-f0-9]{12}$/;
export const bracketPath = (id: string) => `brackets/${id}.json`;

/** Read the picks stored under a share id, or `null` when the id is malformed
 *  or nothing is stored there. */
export async function readBracket(id: string): Promise<Picks | null> {
  if (!ID_RE.test(id)) return null;
  return (await readJson<Picks>(bracketPath(id))) ?? null;
}

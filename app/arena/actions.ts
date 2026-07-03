"use server";

import { checkRateLimit } from "@vercel/firewall";
import { z } from "zod";

import { saveBracket } from "@/lib/arena/brackets";
import { matchByNumber, teamById } from "@/lib/tournament";

// A shareable set of picks: known knockout match → real team code.
const picksSchema = z
  .record(
    z.coerce.number().refine((m) => m in matchByNumber, "unknown match"),
    z.string().refine((code) => code in teamById, "unknown team"),
  )
  .refine((picks) => Object.keys(picks).length > 0, "no picks");

/** Store a human bracket under a fresh share id and return it, or null when the
 *  caller is rate-limited, the payload is invalid, or storage is unavailable. */
export async function shareBracket(picks: unknown): Promise<string | null> {
  // Backed by the "share-bracket" Vercel Firewall rule (5/min per IP);
  // a no-op outside production.
  const { rateLimited } = await checkRateLimit("share-bracket");
  if (rateLimited) return null;
  const parsed = picksSchema.safeParse(picks);
  if (!parsed.success) return null;
  return saveBracket(parsed.data);
}

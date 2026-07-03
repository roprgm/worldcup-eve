import { notFound } from "next/navigation";

import { SharedBracket } from "@/components/bracket-builder";
import type { TeamCode } from "@/components/circular-bracket";
import { getMatchResults } from "@/lib/results";
import { readJson } from "@/lib/storage/blob";

/** A shared prediction: the bracket with the picks stored under the link's
 *  id, read-only. */
export default async function SharedBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const picks = /^[a-f0-9]{12}$/.test(id)
    ? await readJson<Record<number, TeamCode>>(`brackets/${id}.json`)
    : null;
  if (!picks) notFound();
  const results = await getMatchResults();
  return <SharedBracket results={results} picks={picks} />;
}

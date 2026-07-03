import { notFound } from "next/navigation";

import { readBracket } from "@/app/bracket/storage";
import { SharedBracket } from "@/components/bracket-builder";
import { getMatchResults } from "@/lib/results";

/** A shared prediction: the bracket with the picks stored under the link's
 *  id, read-only. */
export default async function SharedBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const picks = await readBracket(id);
  if (!picks) notFound();
  const results = await getMatchResults();
  return <SharedBracket results={results} picks={picks} />;
}

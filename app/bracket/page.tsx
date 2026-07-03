import { BracketBuilder } from "@/components/bracket-builder";
import { getMatchResults } from "@/lib/results";

export default async function BracketPage() {
  const results = await getMatchResults();
  return <BracketBuilder results={results} />;
}

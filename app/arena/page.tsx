import { ArenaApp } from "@/components/arena/arena-app";
import { readRuns } from "@/lib/arena/storage";
import { getMatchResults } from "@/lib/results";

export const metadata = {
  title: "WorldCup Arena",
  description:
    "AI models predict the World Cup knockout bracket — ranked by how right they turn out to be.",
};

// Stored runs and live results both change; always render fresh.
export const dynamic = "force-dynamic";

/** The arena: every model's run is loaded once, then the leaderboard and the
 *  per-run detail carousel run entirely client-side. */
export default async function ArenaPage() {
  const [runs, results] = await Promise.all([readRuns(), getMatchResults()]);
  return <ArenaApp runs={runs} results={results} />;
}

import { RunList } from "@/components/arena/run-list";
import { readIndex } from "@/lib/arena/storage";
import { getMatchResults } from "@/lib/results";

export const metadata = {
  title: "WorldCup Arena",
  description:
    "AI models predict the World Cup knockout bracket — ranked by how right they turn out to be.",
};

// Blob-backed runs and live results both change; always render fresh.
export const dynamic = "force-dynamic";

/** The arena leaderboard: every model's predicted bracket, scored against the
 *  results so far. */
export default async function ArenaPage() {
  const [runs, results] = await Promise.all([readIndex(), getMatchResults()]);
  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          WorldCup Arena
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          AI models fill in the knockout bracket as a chain of “A or B”
          questions, from the Round of 32 to the final. Each run is scored
          against the real results — a correct pick is worth 1 point in the R32
          and doubles each round, up to 16 for the champion.
        </p>
      </header>
      <RunList runs={runs} results={results} />
    </>
  );
}

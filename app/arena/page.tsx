import { RunList } from "@/components/arena/run-list";
import { readIndex } from "@/lib/arena/storage";
import { getMatchResults } from "@/lib/results";

export const metadata = {
  title: "WorldCup Arena",
  description:
    "AI models predict the World Cup knockout bracket — ranked by how right they turn out to be.",
};

// Stored runs and live results both change; always render fresh.
export const dynamic = "force-dynamic";

/** The arena leaderboard: every model's predicted bracket, scored against the
 *  results so far. */
export default async function ArenaPage() {
  const [runs, results] = await Promise.all([readIndex(), getMatchResults()]);
  return (
    <>
      <header className="mb-6 flex flex-col items-center text-center">
        <h1 className="animate-fade-up text-xl font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
          WorldCup Arena
        </h1>
        <p className="mt-2 max-w-md text-sm text-balance text-muted-foreground">
          Which AI knows football best? Each model calls the entire knockout
          bracket, and we score every pick against what really happens on the
          pitch — the further a team is backed, the bigger the payoff.
        </p>
      </header>
      <RunList runs={runs} results={results} />
    </>
  );
}

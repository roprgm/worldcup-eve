import { BracketBuilder } from "@/components/bracket-builder";
import { getMatchResults } from "@/lib/results";

export const metadata = { title: "Create your own bracket · WorldCup Arena" };

export const dynamic = "force-dynamic";

/** Build your own bracket, then share it to see how it stacks up against the
 *  models. */
export default async function NewBracketPage() {
  const results = await getMatchResults();
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="animate-fade-up text-xl font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
        Create your own bracket
      </h1>
      <p className="mt-2 max-w-md text-sm text-balance text-muted-foreground">
        Tap a team to send it through, round by round. Share your bracket to pit
        your picks against the models.
      </p>
      <div className="mt-6 w-full max-w-lg">
        <BracketBuilder results={results} />
      </div>
    </div>
  );
}

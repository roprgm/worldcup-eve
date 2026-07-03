"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SharedBracket } from "@/components/bracket-builder";
import { rankRuns } from "@/lib/arena/score";
import type { ArenaRunView } from "@/lib/arena/types";
import type { Results } from "@/lib/results";
import { CreateBracketCard } from "./create-bracket-card";
import { RunMeta, RunPicks } from "./run-detail";
import { RunList } from "./run-list";
import { RunNav } from "./run-nav";

function Intro() {
  return (
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
  );
}

/** The whole /arena experience in one client page: the leaderboard and the
 *  per-run detail. Every run is already loaded, so opening a run and stepping
 *  between models is instant and the bracket transitions in place (no re-mount).
 *  Selection lives in component state — not the URL — so a refresh returns to the
 *  list, and the browser back button steps out of a run. */
export function ArenaApp({
  runs,
  results,
}: {
  runs: ArenaRunView[];
  results: Results;
}) {
  const ranked = useMemo(() => rankRuns(runs, results), [runs, results]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const open = useCallback((id: string) => {
    setSelectedId(id);
    // A history entry so the back button/gesture leaves the run for the list,
    // without putting the selection in the URL.
    history.pushState({ arenaRun: id }, "");
  }, []);

  useEffect(() => {
    const onPop = () => setSelectedId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const idx = selectedId
    ? ranked.findIndex((r) => r.run.id === selectedId)
    : -1;

  if (idx < 0)
    return (
      <>
        <Intro />
        <div className="flex flex-col gap-2">
          <RunList runs={runs} results={results} onSelect={open} />
          <CreateBracketCard />
        </div>
      </>
    );

  const { run, score } = ranked[idx];
  const prevId = idx > 0 ? ranked[idx - 1].run.id : null;
  const nextId = idx < ranked.length - 1 ? ranked[idx + 1].run.id : null;
  const reasoning = new Map(
    run.questions
      .filter((q) => q.reasoning)
      .map((q) => [q.match, q.reasoning as string]),
  );

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => history.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Leaderboard
      </button>
      <RunNav
        title={run.label}
        rank={`Rank ${idx + 1} of ${ranked.length}`}
        hasPrev={prevId !== null}
        hasNext={nextId !== null}
        onPrev={() => prevId && setSelectedId(prevId)}
        onNext={() => nextId && setSelectedId(nextId)}
      />
      {/* One persistent bracket: only its picks change as you step, so the flags
          transition in place instead of the whole thing re-mounting. */}
      <div className="mx-auto w-full max-w-lg">
        <SharedBracket
          results={results}
          picks={run.picks}
          reasoning={reasoning}
        />
      </div>
      <RunPicks questions={run.questions} results={results} />
      <RunMeta run={run} score={score} />
    </div>
  );
}

// Debug-only view for the third-place computation (Step 1): the ranked best
// thirds as things stand and the Round-of-32 matchups they imply via FIFA's
// allocation table. Reads real results server-side; not linked from the app.

import { Flag } from "@/components/flags";
import { buildResults } from "@/lib/results";
import { matchByNumber, teamById } from "@/lib/tournament";

export const dynamic = "force-dynamic";

const name = (code: string) => teamById[code]?.name ?? code;

// The group winner that hosts a third in a given Round-of-32 match.
function hostWinner(match: number): string {
  const m = matchByNumber[match];
  const ref = m.home.kind === "winner" ? m.home : m.away;
  return ref.kind === "winner" ? ref.group : "?";
}

function Team({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag code={code} size={14} />
      <span className="font-semibold">{code}</span>
      <span className="text-muted-foreground">{name(code)}</span>
    </span>
  );
}

export default async function ThirdsDebugPage() {
  let results: Awaited<ReturnType<typeof buildResults>> | null = null;
  let error: string | null = null;
  try {
    results = await buildResults();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (!results) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-sm">
        <h1 className="text-lg font-semibold">Debug · Best thirds</h1>
        <p className="mt-3 text-rose-400">results unavailable: {error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6 text-sm">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Debug · Best thirds</h1>
        <p className="text-muted-foreground">
          Deterministic from current standings (points → GD → GF). Provisional
          until every group is final. Snapshot {results.updatedAt}.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-semibold tracking-wide text-muted-foreground uppercase">
          Ranking ({results.bestThirds.length})
        </h2>
        <table className="w-full border-collapse text-left tabular-nums">
          <thead className="text-[11px] tracking-wide text-muted-foreground/70 uppercase">
            <tr className="border-b border-surface-border">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Grp</th>
              <th className="py-1 pr-2">Team</th>
              <th className="py-1 pr-2 text-right">Pts</th>
              <th className="py-1 pr-2 text-right">GD</th>
              <th className="py-1 pr-2 text-right">GF</th>
              <th className="py-1 pr-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.bestThirds.map((t) => (
              <tr
                key={t.group}
                className="border-b border-surface-divider last:border-0"
              >
                <td className="py-1 pr-2 text-muted-foreground">{t.rank}</td>
                <td className="py-1 pr-2 font-semibold">3{t.group}</td>
                <td className="py-1 pr-2">
                  <Team code={t.teamId} />
                </td>
                <td className="py-1 pr-2 text-right">{t.points}</td>
                <td className="py-1 pr-2 text-right">
                  {t.goalDiff >= 0 ? "+" : ""}
                  {t.goalDiff}
                </td>
                <td className="py-1 pr-2 text-right">{t.goalsFor}</td>
                <td className="py-1 pr-2">
                  {t.qualifies ? (
                    <span className="text-pick">qualifies</span>
                  ) : (
                    <span className="text-muted-foreground/50">out</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold tracking-wide text-muted-foreground uppercase">
          Round-of-32 slots ({results.thirdSlots.length})
        </h2>
        <ul className="space-y-1.5">
          {results.thirdSlots.map((slot) => (
            <li key={slot.match} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-muted-foreground">
                #{slot.match}
              </span>
              <span className="w-28 shrink-0 text-muted-foreground">
                Winner {hostWinner(slot.match)}
              </span>
              <span className="text-muted-foreground">vs 3{slot.group}</span>
              <Team code={slot.teamId} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

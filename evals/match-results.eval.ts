import { defineEval } from "eve/evals";

type MatchResult = {
  id?: number;
  competitions?: Array<{
    competitors?: Array<{
      score?: string;
      team?: { abbreviation?: string };
    }>;
  }>;
};

function matchesFrom(output: unknown): MatchResult[] {
  if (!output || typeof output !== "object") {
    return [];
  }
  const results = (output as { results?: unknown }).results;
  return Array.isArray(results) ? (results as MatchResult[]) : [];
}

function hasScore(
  output: unknown,
  id: number,
  homeCode: string,
  homeScore: number,
  awayCode: string,
  awayScore: number,
): boolean {
  return matchesFrom(output).some((match) => {
    const competitors = match.competitions?.[0]?.competitors;
    return (
      match.id === id &&
      competitors?.[0]?.team?.abbreviation === homeCode &&
      competitors[0].score === String(homeScore) &&
      competitors[1]?.team?.abbreviation === awayCode &&
      competitors[1].score === String(awayScore)
    );
  });
}

export default defineEval({
  description: "Use batch result data for a specific World Cup date.",
  async test(t) {
    await t.send(
      "Cuál es el resultado de todos los partidos del 19 de junio de 2026?",
    );

    t.completed();
    t.calledTool("get_match_results", {
      output: (output: unknown) =>
        hasScore(output, 32, "USA", 2, "AUS", 0) &&
        hasScore(output, 30, "SCO", 0, "MAR", 1) &&
        hasScore(output, 29, "BRA", 3, "HAI", 0) &&
        hasScore(output, 31, "TUR", 0, "PAR", 1),
    });
  },
});

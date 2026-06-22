import { defineEval } from "eve/evals";

type MatchDetail = {
  id?: number;
  events?: Array<{
    type?: { type?: string };
    team?: { displayName?: string };
  }>;
};

function hasBrazilGoal(output: unknown): boolean {
  if (!output || typeof output !== "object") {
    return false;
  }
  const detail = output as MatchDetail;
  return (
    detail.id === 29 &&
    Array.isArray(detail.events) &&
    detail.events.some(
      (event) =>
        event.type?.type === "goal" && event.team?.displayName === "Brazil",
    )
  );
}

export default defineEval({
  description: "Use match detail data for a specific match incident question.",
  async test(t) {
    await t.send("Qué pasó en el partido 29?");

    t.completed();
    t.calledTool("get_match_detail", { output: hasBrazilGoal });
  },
});

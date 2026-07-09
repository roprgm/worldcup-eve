import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "An incident question calls the query tool, and a " +
    "score follow-up stays on the same match from context.",
  async test(t) {
    const incident = await t.send("Who got the red card in Belgium vs Iran?");
    incident.calledTool("query");

    await t.send("And what was the final score?");

    t.succeeded();
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer report the final score of the Belgium vs Iran match?",
    );
  },
});

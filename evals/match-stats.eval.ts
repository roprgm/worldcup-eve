import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "An aggregate stats question is answered with one SQL query instead of " +
    "scanning fixtures through context, and names concrete matches.",
  async test(t) {
    await t.send("In which matches was there a goal in the first 5 minutes?");

    t.succeeded();
    t.calledTool("query");
    t.notCalledTool("matches");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer name specific matches (teams) where a goal was scored " +
        "in the first five minutes, or clearly state there were none?",
    );
  },
});

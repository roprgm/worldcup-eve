import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A standings question shows the group standings widget via a group block.",
  async test(t) {
    await t.send("Show me the Group C standings.");

    t.succeeded();
    t.messageIncludes("```group");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer concern the Group C standings or the teams in that group?",
    );
  },
});

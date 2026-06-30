import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A head-to-head between two teams not drawn together still gets a model win-odds estimate.",
  async test(t) {
    await t.send("What are the odds Mexico beats England?");

    t.completed();
    t.calledTool("odds");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer give win-probability estimates for Mexico vs England, rather than refusing because they haven't been drawn together?",
    );
  },
});

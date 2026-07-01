import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A predicted-score / match-odds question routes to the odds tool.",
  async test(t) {
    await t.send("What's the predicted score for Brazil vs Morocco?");

    t.succeeded();
    t.calledTool("odds");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer address the Brazil vs Morocco match with a predicted score or win odds?",
    );
  },
});

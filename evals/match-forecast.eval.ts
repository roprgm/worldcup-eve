import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A predicted-score / match-odds question routes to get_match_forecast.",
  async test(t) {
    await t.send("What's the predicted score for Brazil vs Morocco?");

    t.completed();
    t.calledTool("get_match_forecast");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer address the Brazil vs Morocco match with a predicted score or win odds?",
    );
  },
});

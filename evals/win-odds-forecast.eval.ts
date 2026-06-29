import { defineEval } from "eve/evals";

export default defineEval({
  description: "A head-to-head win-odds question routes to get_match_forecast.",
  async test(t) {
    await t.send("Who's favored, Spain or Uruguay?");

    t.completed();
    t.calledTool("get_match_forecast");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer say which of Spain or Uruguay is favored?",
    );
  },
});

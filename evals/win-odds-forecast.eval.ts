import { defineEval } from "eve/evals";

export default defineEval({
  description: "A head-to-head win-odds question routes to the odds tool.",
  async test(t) {
    await t.send("Who's favored, Spain or Uruguay?");

    t.succeeded();
    t.calledTool("odds");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer say which of Spain or Uruguay is favored?",
    );
  },
});

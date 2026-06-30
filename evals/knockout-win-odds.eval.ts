import { defineEval } from "eve/evals";

export default defineEval({
  description: "A knockout head-to-head win-odds question routes to match.",
  async test(t) {
    await t.send("What are the odds in the South Africa vs Canada match?");

    t.completed();
    t.calledTool("match");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer give the win odds for the South Africa vs Canada match?",
    );
  },
});

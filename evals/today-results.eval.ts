import { defineEval } from "eve/evals";

export default defineEval({
  description: "A 'matches today' question shows match cards via show_match.",
  async test(t) {
    await t.send("Which matches are playing today?");

    t.succeeded();
    t.calledTool("show_match", { input: { scope: "today" } });
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer report the match or matches taking place today?",
    );
  },
});

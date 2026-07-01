import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'matches today' question uses the match tool with scope today.",
  async test(t) {
    await t.send("Which matches are playing today?");

    t.completed();
    t.calledTool("match", { input: { scope: "today" } });
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer report the match or matches taking place today?",
    );
  },
});

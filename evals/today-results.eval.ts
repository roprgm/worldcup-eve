import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'matches today' question shows match cards via a match block.",
  async test(t) {
    await t.send("Which matches are playing today?");

    t.succeeded();
    t.messageIncludes("```match");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer report the match or matches taking place today?",
    );
  },
});

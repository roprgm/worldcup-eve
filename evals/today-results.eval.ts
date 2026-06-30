import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'matches today' question shows match cards via a <match> tag.",
  async test(t) {
    await t.send("Which matches are playing today?");

    t.completed();
    t.messageIncludes(/<match[^>]*today/i);
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer report the match or matches taking place today?",
    );
  },
});

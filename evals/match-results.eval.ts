import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A score question routes to the matches tool and reports a score.",
  async test(t) {
    await t.send("What was the score of Brazil vs Haiti?");

    t.completed();
    t.calledTool("matches");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer report the final score of the Brazil vs Haiti match?",
    );
  },
});

import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A past-match venue question calls the matches tool and names a stadium.",
  async test(t) {
    await t.send("Where did Argentina play their last match?");

    t.succeeded();
    t.calledTool("matches");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer name the stadium or venue where the match was played?",
    );
  },
});

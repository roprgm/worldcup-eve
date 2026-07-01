import { defineEval } from "eve/evals";

export default defineEval({
  description: "A stadium/venue question calls the matches tool.",
  async test(t) {
    await t.send("Where is match 50 played?");

    t.completed();
    t.calledTool("matches");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer name the stadium or city where the match is played?",
    );
  },
});

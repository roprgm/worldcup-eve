import { defineEval } from "eve/evals";

export default defineEval({
  description: "A fixture/kickoff question calls the matches tool.",
  async test(t) {
    await t.send("When does match 50 kick off?");

    t.completed();
    t.calledTool("matches");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer give a kickoff time or date for the match?",
    );
  },
});

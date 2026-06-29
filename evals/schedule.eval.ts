import { defineEval } from "eve/evals";

export default defineEval({
  description: "A fixture/kickoff question calls the get_match_schedule tool.",
  async test(t) {
    await t.send("When does match 50 kick off?");

    t.completed();
    t.calledTool("get_match_schedule");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer give a kickoff time or date for the match?",
    );
  },
});

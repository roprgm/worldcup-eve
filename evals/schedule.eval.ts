import { defineEval } from "eve/evals";

export default defineEval({
  description: "A fixture/kickoff question calls the get_match_schedule tool.",
  async test(t) {
    await t.send("When does match 50 kick off?");

    t.completed();
    t.calledTool("get_match_schedule");
    t.noFailedActions();
    t.messageIncludes(/:\d\d|UTC|Jun/i);
  },
});

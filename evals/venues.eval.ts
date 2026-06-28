import { defineEval } from "eve/evals";

export default defineEval({
  description: "A stadium/venue question calls the get_match_venues tool.",
  async test(t) {
    await t.send("Where is match 50 played?");

    t.completed();
    t.calledTool("get_match_venues");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer name the stadium or city where the match is played?",
    );
  },
});

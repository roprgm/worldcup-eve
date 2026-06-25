import { defineEval } from "eve/evals";

export default defineEval({
  description: "A 'matches today' question routes to get_match_results.",
  async test(t) {
    await t.send("Which matches are playing today?");

    t.completed();
    t.calledTool("get_match_results");
    t.noFailedActions();
    t.messageIncludes(/vs|match|today/i);
  },
});

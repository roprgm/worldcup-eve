import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A win-likelihood question about the next match routes to get_match_forecast.",
  async test(t) {
    await t.send("Who is more likely to win the next match?");

    t.completed();
    t.calledTool("get_match_forecast");
    t.noFailedActions();
    t.messageIncludes(/%|likely|favou?r|win/i);
  },
});

import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A knockout head-to-head win-odds question routes to get_match_forecast.",
  async test(t) {
    await t.send("What are the odds in the South Africa vs Canada match?");

    t.completed();
    t.calledTool("get_match_forecast");
    t.noFailedActions();
    t.messageIncludes(/South Africa|Canada/i);
  },
});

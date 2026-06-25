import { defineEval } from "eve/evals";

export default defineEval({
  description: "A score question routes to get_match_results.",
  async test(t) {
    await t.send("What was the score of Brazil vs Haiti?");

    t.completed();
    t.calledTool("get_match_results");
  },
});

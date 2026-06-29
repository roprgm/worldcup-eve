import { defineEval } from "eve/evals";

export default defineEval({
  description: "A title-odds question routes to get_match_prediction.",
  async test(t) {
    await t.send("Who is the favorite to win the World Cup?");

    t.completed();
    t.calledTool("get_match_prediction");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer name a favorite or give title-winning odds for a team?",
    );
  },
});

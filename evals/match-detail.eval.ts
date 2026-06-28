import { defineEval } from "eve/evals";

export default defineEval({
  description: "A card/incident question routes to get_match_detail.",
  async test(t) {
    await t.send("Who got the red card in Belgium vs Iran?");

    t.completed();
    t.calledTool("get_match_detail");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer identify which player received the red card?",
    );
  },
});

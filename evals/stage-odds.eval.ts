import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Asking how likely teams are to go far / win shows the per-team odds via show_stage_odds, not the bracket.",
  async test(t) {
    await t.send("Who are the favourites to win the World Cup?");

    t.completed();
    t.calledTool("show_stage_odds");
    t.noFailedActions();
  },
});

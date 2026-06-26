import { defineEval } from "eve/evals";

export default defineEval({
  description: "A third-placed teams question routes to get_best_thirds.",
  async test(t) {
    await t.send("Which third-placed teams qualify for the Round of 32?");

    t.completed();
    t.calledTool("get_best_thirds");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer name third-placed teams and indicate which ones are currently among the best eight qualifying for the Round of 32?",
    );
  },
});

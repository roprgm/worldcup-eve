import { defineEval } from "eve/evals";

export default defineEval({
  description: "A third-placed teams question uses the thirds tool.",
  async test(t) {
    await t.send("Which third-placed teams qualify for the Round of 32?");

    t.completed();
    t.calledTool("thirds");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer name third-placed teams and indicate which ones are currently among the best eight qualifying for the Round of 32?",
    );
  },
});

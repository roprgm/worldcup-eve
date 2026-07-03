import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A single-fixture when/where question shows the match widget — not the " +
    "path or slot widgets backed by outlook.",
  async test(t) {
    await t.send("When and where is Argentina vs Cape Verde played?");

    t.succeeded();
    t.calledTool("show_match");
    t.notCalledTool("show_path");
    t.notCalledTool("show_slot");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer give the stadium and the date or time of the Argentina vs Cape Verde match?",
    );
  },
});

import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A single-fixture when/where question routes to the matches tool — not to " +
    "outlook, which backs the path and slot widgets.",
  async test(t) {
    await t.send("When and where is Argentina vs Cape Verde played?");

    t.succeeded();
    t.calledTool("matches");
    t.notCalledTool("outlook");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer give the stadium and the date or time of the Argentina vs Cape Verde match?",
    );
  },
});

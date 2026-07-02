import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A bare 'who will win?' with no match in context is about the World Cup title, not whatever fixture happens to be next.",
  async test(t) {
    await t.send("Who will win?");

    t.succeeded();
    t.calledTool("outlook");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer treat the question as being about winning the World Cup (a title favorite or champion odds) rather than about one specific upcoming match?",
    );
  },
});

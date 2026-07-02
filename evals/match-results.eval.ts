import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "An incident question calls the matches tool with the timeline, and a " +
    "score follow-up stays on the same match from context.",
  async test(t) {
    await t.send("Who got the red card in Belgium vs Iran?");
    await t.send("And what was the final score?");

    t.succeeded();
    t.calledTool("matches", { input: { timeline: true } });
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer report the final score of the Belgium vs Iran match?",
    );
  },
});

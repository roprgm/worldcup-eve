import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'who's likely to play' knockout question shows the slot widget via a slot block and is framed as a prediction.",
  async test(t) {
    await t.send("Who is most likely to play in match 100?");

    t.succeeded();
    t.calledTool("outlook", { input: { slot: 100 } });
    t.messageIncludes("```slot");
    t.noFailedActions();
    t.judge.autoevals.closedQA("Does the answer mention two teams?");
  },
});

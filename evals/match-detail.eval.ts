import { defineEval } from "eve/evals";

export default defineEval({
  description: "A card/incident question calls the matches tool with timeline.",
  async test(t) {
    await t.send("Who got the red card in Belgium vs Iran?");

    t.succeeded();
    t.calledTool("matches", { input: { timeline: true } });
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer identify which player received the red card?",
    );
  },
});

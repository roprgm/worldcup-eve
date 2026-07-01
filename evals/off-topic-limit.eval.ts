import { defineEval } from "eve/evals";

export default defineEval({
  description: "Redirect unrelated requests without calling tools.",
  async test(t) {
    await t.send("Help me write a very detailed rental contract.");

    t.succeeded();
    t.usedNoTools();
    t.judge.autoevals.closedQA(
      "Does the assistant decline or refuse the request instead of helping write the contract?",
    );
  },
});

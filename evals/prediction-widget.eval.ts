import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A team's tournament prediction shows the chances widget via a chances block.",
  async test(t) {
    await t.send("Dame la predicción de México para el Mundial");

    t.succeeded();
    t.calledTool("outlook");
    t.messageIncludes("```chances");
    t.noFailedActions();
  },
});

import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A team's title/prediction chances show the chances widget via a chances block.",
  async test(t) {
    await t.send("¿Cuáles son las chances de México de ganar la final?");

    t.completed();
    t.calledTool("outlook");
    t.messageIncludes("```chances");
    t.noFailedActions();
  },
});

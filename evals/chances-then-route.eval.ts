import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A team's title chances show the chances widget; a follow-up route question " +
    "shows the path widget instead of narrating the route.",
  async test(t) {
    await t.send("¿Cuáles son las chances de México de ganar la final?");
    await t.send("¿Cuál es la ruta a la final?");

    t.succeeded();
    t.calledTool("outlook");
    t.messageIncludes("```chances");
    t.messageIncludes("```path");
    t.noFailedActions();
  },
});

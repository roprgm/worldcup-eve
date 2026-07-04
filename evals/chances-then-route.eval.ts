import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A team's title chances show the chances widget; a follow-up route question " +
    "shows the path widget instead of narrating the route.",
  async test(t) {
    const chances = await t.send(
      "¿Cuáles son las chances de México de ganar la final?",
    );
    chances.calledTool("show_chances");

    const route = await t.send("¿Cuál es la ruta a la final?");
    route.calledTool("show_path");

    t.succeeded();
    t.noFailedActions();
  },
});

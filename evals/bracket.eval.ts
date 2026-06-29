import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Asking to see the knockout bracket / draw shows it via show_bracket, not the per-team odds table.",
  async test(t) {
    await t.send("Show me the World Cup knockout bracket");

    t.completed();
    t.calledTool("show_bracket");
    t.noFailedActions();
  },
});

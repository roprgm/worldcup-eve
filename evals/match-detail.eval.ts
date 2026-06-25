import { defineEval } from "eve/evals";

export default defineEval({
  description: "A card/incident question routes to get_match_detail.",
  async test(t) {
    await t.send("Who got the red card in Belgium vs Iran?");

    t.completed();
    t.calledTool("get_match_detail");
    t.noFailedActions();
    t.messageIncludes(/Belgium|Iran/i);
  },
});

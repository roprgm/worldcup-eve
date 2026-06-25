import { defineEval } from "eve/evals";

export default defineEval({
  description: "A goalscorer/incident question routes to get_match_detail.",
  async test(t) {
    await t.send("Who scored in match 29?");

    t.completed();
    t.calledTool("get_match_detail");
  },
});

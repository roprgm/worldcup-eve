import { defineEval } from "eve/evals";

export default defineEval({
  description: "A group-table question routes to get_group_standings.",
  async test(t) {
    await t.send("Show me the Group C standings.");

    t.completed();
    t.calledTool("get_group_standings");
  },
});

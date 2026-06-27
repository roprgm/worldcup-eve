import { defineEval } from "eve/evals";

export default defineEval({
  description: "A standings question shows the group standings widget.",
  async test(t) {
    await t.send("Show me the Group C standings.");

    t.completed();
    t.calledTool("show_group_standings", { input: { group: "C" } });
    t.noFailedActions();
    t.messageIncludes(/Brazil|Morocco|Haiti|Scotland/i);
  },
});

import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "The 'road to the final' home suggestion shows the team's path widget via a path block.",
  async test(t) {
    await t.send("What's Argentina's road to the final?");

    t.succeeded();
    t.calledTool("outlook");
    t.messageIncludes("```path");
    t.noFailedActions();
  },
});

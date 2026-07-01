import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "The 'how far can a team go' home suggestion shows the chances widget via a chances block.",
  async test(t) {
    await t.send("How far can Brazil go this World Cup?");

    t.succeeded();
    t.calledTool("outlook");
    t.messageIncludes("```chances");
    t.noFailedActions();
  },
});

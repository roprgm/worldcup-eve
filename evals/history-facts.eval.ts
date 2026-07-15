import { defineEval } from "eve/evals";

// Needs a synced history database (DATABASE_URL + `bun run sync:history`) on
// the deployment under eval — without it the tool reports no data and the
// judge rightly fails.
export default defineEval({
  description:
    "An all-time history question is answered from the history database with a read-only SELECT, in prose.",
  async test(t) {
    await t.send("How many times has Argentina reached a World Cup final?");

    t.succeeded();
    t.calledTool("history");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer state a specific count (six or more) of World Cup finals Argentina has reached, without claiming the data is unavailable?",
    );
  },
});

import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'next match' question is answered from the matches tool, not from memory.",
  async test(t) {
    await t.send("What's the next match?");

    t.succeeded();
    t.calledTool("matches");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer name the teams (or decided slot) of an upcoming World Cup fixture?",
    );
  },
});

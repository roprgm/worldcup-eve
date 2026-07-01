import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'when do X and Y play' question stays on the fixture and avoids the slot-chances and road-to-the-final widgets.",
  async test(t) {
    await t.send("When is Argentina vs Cape Verde played?");

    t.completed();
    // outlook backs the path (whole route) and slot (slot chances) widgets —
    // the wrong tools for a single fixture, which should use the matches tool.
    t.notCalledTool("outlook");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer address the single Argentina vs Cape Verde fixture (when/where it's played or its odds), rather than listing a team's path through several rounds or each side's chances of reaching a slot?",
    );
  },
});

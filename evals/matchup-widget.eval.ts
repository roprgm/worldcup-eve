import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'when do X and Y play' question stays on the single pairing — not the road-to-the-final tool, and not framed as an undecided bracket slot.",
  async test(t) {
    await t.send("When is Argentina vs Cape Verde played?");

    t.completed();
    t.calledTool("match", {
      output: (output: unknown) => {
        const matches =
          (output as { matches?: Array<{ state?: string }> }).matches ?? [];
        // Not the show_knockout_match-style candidates shape — a single
        // resolved pairing (real or, since these two haven't been drawn
        // together, the hypothetical estimate), never "TBD, here's who might
        // reach this slot."
        return (
          matches.length > 0 && !matches.some((m) => m.state === "undecided")
        );
      },
    });
    t.notCalledTool("team");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer address the single Argentina vs Cape Verde pairing (when/where it's played or its odds), rather than listing a team's path through several rounds or each side's chances of reaching a slot?",
    );
  },
});

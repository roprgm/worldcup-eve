import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A past-match venue question calls the get_match_venues tool and names a stadium.",
  async test(t) {
    await t.send("Where did Argentina play their last match?");

    t.completed();
    t.calledTool("get_match_venues");
    t.noFailedActions();
    t.messageIncludes(/Stadium/i);
  },
});

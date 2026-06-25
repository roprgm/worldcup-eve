import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'who's likely to play' knockout question routes to get_knockout_forecast.",
  async test(t) {
    await t.send("Who is likely to play in match 100?");

    t.completed();
    t.calledTool("get_knockout_forecast");
  },
});

import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A third-placed teams question uses the standings thirds race or a thirds block.",
  async test(t) {
    await t.send("Which third-placed teams qualify for the Round of 32?");

    t.completed();
    t.event((events) => {
      const payload = JSON.stringify(events);
      return payload.includes('"standings"') || payload.includes("```thirds");
    }, "used the standings tool or a thirds widget block");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer name third-placed teams and indicate which ones are currently among the best eight qualifying for the Round of 32?",
    );
  },
});

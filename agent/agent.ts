import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-oss-120b",
  modelOptions: {
    providerOptions: {
      // gpt-oss-120b is open-weights; route to the fastest providers that serve it.
      gateway: { order: ["cerebras", "groq", "fireworks"] },
      // Factual World Cup lookups don't need long chains of thought. Low reasoning
      // effort cuts latency and output-token cost; the instructions already tell the
      // agent not to over-reason. Raise to "medium" if tool selection regresses.
      openai: { reasoningEffort: "low" },
    },
  },
});

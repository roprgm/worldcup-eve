import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Handles World Cup questions that need multi-step reasoning, several tool calls, prediction synthesis, or careful explanation before the parent replies.",
  model: "openai/gpt-oss-120b",
  modelOptions: {
    providerOptions: {
      gateway: {
        order: ["baseten", "groq", "parasail", "cerebras", "fireworks"],
      },
      openai: { reasoningEffort: "medium" },
    },
  },
});

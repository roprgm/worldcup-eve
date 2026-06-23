import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-oss-120b",
  modelOptions: {
    providerOptions: {
      // gpt-oss-120b is open-weights; prefer Groq (fastest provider that serves it).
      gateway: { order: ["cerebras", "groq", "fireworks"] },
    },
  },
});

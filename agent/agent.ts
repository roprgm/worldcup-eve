import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-oss-120b",
  modelOptions: {
    providerOptions: {
      // gpt-oss-120b is open-weights; route to the fastest providers that serve it.
      gateway: { order: ["cerebras", "groq", "fireworks"] },
      // Medium reasoning keeps tool selection and replies reliable (low let the
      // model ramble/derail on some multi-step asks); the instructions still tell
      // the agent not to over-reason, which caps the latency/token cost.
      openai: { reasoningEffort: "medium" },
    },
  },
});

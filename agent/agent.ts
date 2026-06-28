import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-oss-120b",
  modelOptions: {
    providerOptions: {
      // gpt-oss-120b is open-weights. The fastest providers (cerebras/groq) can
      // leak the harmony reasoning channel into the visible reply on multi-turn
      // chats — the model derails into an apology loop. Prefer fireworks, which
      // handles the channel split more faithfully, and keep the others as fallback.
      gateway: { order: ["fireworks", "groq", "cerebras"] },
      // Keep reasoning low: medium added analysis tokens (more to leak) without
      // fixing the derail, and these lookups don't need long chains of thought.
      openai: { reasoningEffort: "low" },
    },
  },
});

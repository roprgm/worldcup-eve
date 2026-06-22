import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-5-nano",
  modelOptions: {
    providerOptions: {
      openai: {
        reasoningEffort: "low",
      },
    },
  },
});

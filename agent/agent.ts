import { defineAgent } from "eve";

export default defineAgent({
  model: "xai/grok-4.1-fast-non-reasoning",
  modelOptions: {
    providerOptions: {
      gateway: { order: ["vertex"], cacheControl: "max-age=0" },
    },
  },
});

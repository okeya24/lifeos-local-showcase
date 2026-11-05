import { getOllamaStatus, streamOllamaChat } from "./ollama.mjs";

const providerName = process.env.MODEL_PROVIDER || "ollama";

if (providerName !== "ollama") {
  throw new Error(
    `Unsupported MODEL_PROVIDER "${providerName}". Add its adapter in server/providers/.`
  );
}

export const modelProvider = {
  name: "ollama",
  getStatus: getOllamaStatus,
  streamChat: streamOllamaChat
};

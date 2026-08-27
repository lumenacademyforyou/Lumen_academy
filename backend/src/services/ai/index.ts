import { config } from "../../config/env.js";
import { mockProvider } from "./providers/mock.js";
import { openrouterProvider } from "./providers/openrouter.js";
import type { AIProvider } from "./types.js";

export function getAIProvider(): AIProvider {
  switch (config.aiProvider) {
    case "openrouter":
      return openrouterProvider;
    case "mock":
    default:
      return mockProvider;
  }
}

export type { AIProvider, CompletionRequest, CompletionResult } from "./types.js";

import { config } from "../../config.js";
import type { AIProvider, CompletionRequest, CompletionResult } from "../types.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

export const openrouterProvider: AIProvider = {
  name: "openrouter",
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const model = config.openrouterModel || DEFAULT_MODEL;

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.3,
        ...(request.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter request failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";

    return {
      text,
      tokensIn: data?.usage?.prompt_tokens ?? 0,
      tokensOut: data?.usage?.completion_tokens ?? 0,
      model: data?.model ?? model,
    };
  },
};

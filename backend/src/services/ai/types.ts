export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
  json?: boolean;
}

export interface CompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  costUsd?: number;
}

export interface AIProvider {
  name: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

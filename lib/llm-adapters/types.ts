export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletion {
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export interface ProviderRates {
  in: number;
  out: number;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmAdapter {
  name: string;
  chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatCompletion>;
  streamChat(messages: ChatMessage[], opts: ChatOptions): AsyncIterable<string>;
  embed(text: string | string[], opts?: { model?: string }): Promise<number[][]>;
  transcribe(audio: Blob | ArrayBuffer, opts?: { model?: string; language?: string }): Promise<string>;
  ratesPerMillionTokens(model: string): ProviderRates;
}
export interface OllamaChatToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaChatMessageIn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_name?: string;
}

export interface OllamaChatMessageOut {
  role: string;
  content: string;
  thinking?: string;
  tool_calls?: OllamaChatToolCall[];
}

export interface OllamaChatChunk {
  model: string;
  created_at: string;
  message: OllamaChatMessageOut;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessageIn[];
  stream?: boolean;
  tools?: OllamaToolSpec[];
  think?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_ctx?: number;
    num_predict?: number;
  };
  keep_alive?: string;
}

export interface OllamaTagsResponse {
  models: Array<{
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: {
      parent_model?: string;
      format?: string;
      family?: string;
      families?: string[];
      parameter_size?: string;
      quantization_level?: string;
    };
    capabilities?: string[];
    context_length?: number;
  }>;
}

export interface OllamaPsResponse {
  models: Array<{
    name: string;
    model: string;
    size: number;
    digest: string;
    size_vram: number;
    expires_at?: string;
  }>;
}

export interface OllamaPullProgressChunk {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
}

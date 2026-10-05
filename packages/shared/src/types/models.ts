export interface OllamaModelSummary {
  name: string;
  model: string;
  size: number;
  digest: string;
  modifiedAt: string;
  parameterSize?: string;
  quantizationLevel?: string;
  family?: string;
  capabilities?: string[];
  contextLength?: number;
}

export interface OllamaRunningModel {
  name: string;
  model: string;
  sizeVram: number;
  digest: string;
  expiresAt?: string;
}

export interface ModelPullProgress {
  model: string;
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  done: boolean;
  error?: string;
}

export interface QueueRequest {
  id: string;
  timestamp: Date;
  source: 'internet-banking' | 'core-banking' | 'rafiki';
  destination: 'internet-banking' | 'core-banking' | 'rafiki';
  method: string;
  endpoint: string;
  payload: any;
  headers: Record<string, string>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  response?: any;
  error?: string;
  processingTime?: number;
}

export interface ServiceConfig {
  name: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  healthEndpoint?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

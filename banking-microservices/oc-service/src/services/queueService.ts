import { QueueRequest, QueueStats } from '../models/request';
import { v4 as uuidv4 } from 'uuid';

class QueueService {
  private queue: QueueRequest[] = [];
  private processing: Map<string, QueueRequest> = new Map();
  private completed: QueueRequest[] = [];
  private failed: QueueRequest[] = [];

  addRequest(
    source: string,
    destination: string,
    method: string,
    endpoint: string,
    payload: any,
    headers: Record<string, string> = {}
  ): QueueRequest {
    const request: QueueRequest = {
      id: uuidv4(),
      timestamp: new Date(),
      source: source as any,
      destination: destination as any,
      method,
      endpoint,
      payload,
      headers,
      status: 'pending'
    };

    this.queue.push(request);
    console.log(`📨 New request queued: ${request.id} [${source} → ${destination}] ${method} ${endpoint}`);
    return request;
  }

  getNextRequest(): QueueRequest | null {
    const request = this.queue.shift();
    if (request) {
      request.status = 'processing';
      this.processing.set(request.id, request);
      console.log(`🔄 Processing request: ${request.id}`);
    }
    return request || null;
  }

  completeRequest(id: string, response: any, processingTime: number): void {
    const request = this.processing.get(id);
    if (request) {
      request.status = 'completed';
      request.response = response;
      request.processingTime = processingTime;
      this.processing.delete(id);
      this.completed.push(request);
      
      // Keep only last 100 completed requests
      if (this.completed.length > 100) {
        this.completed.shift();
      }
      
      console.log(`✅ Request completed: ${id} (${processingTime}ms)`);
    }
  }

  failRequest(id: string, error: string, processingTime?: number): void {
    const request = this.processing.get(id);
    if (request) {
      request.status = 'failed';
      request.error = error;
      request.processingTime = processingTime;
      this.processing.delete(id);
      this.failed.push(request);
      
      // Keep only last 100 failed requests
      if (this.failed.length > 100) {
        this.failed.shift();
      }
      
      console.log(`❌ Request failed: ${id} - ${error}`);
    }
  }

  getStats(): QueueStats {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.length,
      failed: this.failed.length,
      total: this.queue.length + this.processing.size + this.completed.length + this.failed.length
    };
  }

  getAllRequests() {
    return {
      pending: this.queue,
      processing: Array.from(this.processing.values()),
      completed: this.completed.slice(-50), // Last 50 completed
      failed: this.failed.slice(-50) // Last 50 failed
    };
  }

  getRequestById(id: string): QueueRequest | null {
    // Check in processing first
    const processing = this.processing.get(id);
    if (processing) return processing;

    // Check in completed
    const completed = this.completed.find(r => r.id === id);
    if (completed) return completed;

    // Check in failed
    const failed = this.failed.find(r => r.id === id);
    if (failed) return failed;

    // Check in pending
    const pending = this.queue.find(r => r.id === id);
    if (pending) return pending;

    return null;
  }

  clearHistory(): void {
    this.completed = [];
    this.failed = [];
    console.log('🧹 Request history cleared');
  }
}

export const queueService = new QueueService();

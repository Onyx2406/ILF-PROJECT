import axios, { AxiosResponse } from 'axios';
import { QueueRequest, ServiceConfig } from '../models/request';
import { queueService } from './queueService';

class ForwarderService {
  private services: Map<string, ServiceConfig> = new Map([
    ['core-banking', {
      name: 'Core Banking Service',
      baseUrl: process.env.CORE_BANKING_URL || 'http://localhost:3200/api',
      timeout: 30000,
      retries: 3,
      healthEndpoint: '/health'
    }],
    ['internet-banking', {
      name: 'Internet Banking Service',
      baseUrl: process.env.INTERNET_BANKING_URL || 'http://localhost:3100/api',
      timeout: 15000,
      retries: 2,
      healthEndpoint: '/health'
    }],
    ['rafiki', {
      name: 'Rafiki Service',
      baseUrl: process.env.RAFIKI_URL || 'http://localhost:4001',
      timeout: 20000,
      retries: 2,
      healthEndpoint: '/graphql'
    }]
  ]);

  async processQueue(): Promise<void> {
    const request = queueService.getNextRequest();
    if (!request) return;

    const startTime = Date.now();
    
    try {
      const response = await this.forwardRequest(request);
      const processingTime = Date.now() - startTime;
      queueService.completeRequest(request.id, response.data, processingTime);
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      queueService.failRequest(request.id, errorMessage, processingTime);
    }
  }

  private async forwardRequest(request: QueueRequest): Promise<AxiosResponse> {
    const serviceConfig = this.services.get(request.destination);
    if (!serviceConfig) {
      throw new Error(`Unknown destination service: ${request.destination}`);
    }

    const url = `${serviceConfig.baseUrl}${request.endpoint}`;
    
    console.log(`🔄 Forwarding ${request.method} ${url}`);
    console.log(`📦 Payload:`, JSON.stringify(request.payload));
    
    try {
      const config = {
        method: request.method.toLowerCase() as any,
        url,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': request.id,
          'X-Source-Service': request.source,
          'X-Forwarded-By': 'oc-service'
        },
        timeout: 10000, // Reduced timeout for testing
        data: request.payload
      };

      // Remove data for GET requests
      if (request.method.toUpperCase() === 'GET') {
        delete config.data;
      }

      console.log(`🔧 Request config:`, JSON.stringify(config, null, 2));
      const response = await axios(config);
      console.log(`✅ Request successful:`, response.status);
      return response;
    } catch (error: any) {
      console.error(`❌ Axios error details:`, {
        message: error.message,
        code: error.code,
        response: error.response?.status,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  startProcessing(): void {
    // Process queue every 100ms
    setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }, 100);

    console.log('🚀 Forwarder service started - Processing queue every 100ms');
  }

  async checkServiceHealth(serviceName: string): Promise<boolean> {
    try {
      const serviceConfig = this.services.get(serviceName);
      if (!serviceConfig || !serviceConfig.healthEndpoint) return false;

      const response = await axios.get(
        `${serviceConfig.baseUrl}${serviceConfig.healthEndpoint}`,
        { timeout: 5000 }
      );

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  getServiceStatus() {
    return Array.from(this.services.entries()).map(([key, config]) => ({
      name: key,
      displayName: config.name,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retries: config.retries
    }));
  }

  updateServiceConfig(serviceName: string, config: Partial<ServiceConfig>): boolean {
    const existingConfig = this.services.get(serviceName);
    if (!existingConfig) return false;

    this.services.set(serviceName, { ...existingConfig, ...config });
    console.log(`🔧 Updated config for service: ${serviceName}`);
    return true;
  }
}

export const forwarderService = new ForwarderService();

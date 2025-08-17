import { Request, Response } from 'express';
import { queueService } from '../services/queueService';
import { forwarderService } from '../services/forwarderService';

export class RequestController {
  // Forward request to specific service with endpoint
  static async forwardToService(req: Request, res: Response, destination: string, endpoint: string) {
    try {
      const method = req.method || 'POST';
      
      // Determine source from headers or default to 'internet-banking'
      const source = req.headers['x-source-service'] as string || 'internet-banking';
      
      const queuedRequest = queueService.addRequest(
        source,
        destination,
        method,
        endpoint,
        req.body,
        req.headers as Record<string, string>
      );

      // Wait for completion (with timeout)
      const result = await waitForCompletion(queuedRequest.id, 30000);
      
      if (result.status === 'completed') {
        res.json({
          success: true,
          requestId: queuedRequest.id,
          data: result.response,
          processingTime: result.processingTime
        });
      } else {
        res.status(500).json({
          success: false,
          requestId: queuedRequest.id,
          error: result.error || 'Request failed',
          processingTime: result.processingTime
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Forward request to any service through the queue
  static async forwardRequest(req: Request, res: Response) {
    try {
      const { destination } = req.params;
      const { endpoint } = req.query as { endpoint: string };
      const method = req.method || 'POST';
      
      if (!destination || !endpoint) {
        return res.status(400).json({
          success: false,
          error: 'Missing destination or endpoint parameter'
        });
      }

      // Determine source from headers or default to 'internet-banking'
      const source = req.headers['x-source-service'] as string || 'internet-banking';
      
      const queuedRequest = queueService.addRequest(
        source,
        destination,
        method,
        endpoint,
        req.body,
        req.headers as Record<string, string>
      );

      // Wait for completion (with timeout)
      const result = await waitForCompletion(queuedRequest.id, 30000);
      
      if (result.status === 'completed') {
        res.json({
          success: true,
          requestId: queuedRequest.id,
          data: result.response,
          processingTime: result.processingTime
        });
      } else {
        res.status(500).json({
          success: false,
          requestId: queuedRequest.id,
          error: result.error || 'Request failed',
          processingTime: result.processingTime
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Quick forward for simple requests
  static async quickForward(req: Request, res: Response) {
    try {
      const { service } = req.params;
      // For route /quick/:service/* - Express captures everything after /quick/service/ in params[0]
      const wildcardPath = (req.params as any)[0] || '';
      const endpoint = wildcardPath.startsWith('/') ? wildcardPath : `/${wildcardPath}`;
      
      console.log(`🔍 Quick forward: service=${service}, wildcardPath=${wildcardPath}, endpoint=${endpoint}`);
      
      const queuedRequest = queueService.addRequest(
        'oc-service',
        service,
        req.method,
        endpoint,
        req.body,
        req.headers as Record<string, string>
      );

      const result = await waitForCompletion(queuedRequest.id, 15000);
      
      if (result.status === 'completed') {
        res.json(result.response);
      } else {
        res.status(500).json({
          error: result.error || 'Request failed'
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Get queue statistics
  static getStats(req: Request, res: Response) {
    try {
      const stats = queueService.getStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get all requests for monitoring
  static getAllRequests(req: Request, res: Response) {
    try {
      const requests = queueService.getAllRequests();
      res.json({
        success: true,
        data: requests
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get specific request by ID
  static getRequestById(req: Request, res: Response) {
    try {
      const { requestId } = req.params;
      const request = queueService.getRequestById(requestId);
      
      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'Request not found'
        });
      }

      res.json({
        success: true,
        data: request
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get service status
  static getServiceStatus(req: Request, res: Response) {
    try {
      const services = forwarderService.getServiceStatus();
      res.json({
        success: true,
        data: services
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Health check for OC service itself
  static healthCheck(req: Request, res: Response) {
    const stats = queueService.getStats();
    res.json({
      success: true,
      service: 'OC Service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queue: stats
    });
  }

  // Clear request history
  static clearHistory(req: Request, res: Response) {
    try {
      queueService.clearHistory();
      res.json({
        success: true,
        message: 'Request history cleared'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

// Helper function to wait for request completion
function waitForCompletion(requestId: string, timeout: number): Promise<any> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkStatus = () => {
      const request = queueService.getRequestById(requestId);
      
      if (!request) {
        return resolve({ status: 'failed', error: 'Request not found' });
      }
      
      // Check if completed or failed
      if (request.status === 'completed' || request.status === 'failed') {
        return resolve(request);
      }
      
      // Check timeout
      if (Date.now() - startTime > timeout) {
        return resolve({ 
          status: 'failed', 
          error: 'Request timeout',
          processingTime: Date.now() - startTime 
        });
      }
      
      // Continue checking every 50ms
      setTimeout(checkStatus, 50);
    };
    
    checkStatus();
  });
}

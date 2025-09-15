import { Request, Response } from 'express';
import axios from 'axios';

interface RafikiWebhook {
  id: string;
  type: string;
  data: {
    id: string;
    walletAddressId?: string;
    accountId?: string;
    [key: string]: any;
  };
  resourceId?: string;
  createdAt: string;
}

export class WebhookController {
  /**
   * Receive webhook from Rafiki and forward to Core Banking Service
   */
  static async receiveRafikiWebhook(req: Request, res: Response) {
    try {
      const webhook: RafikiWebhook = req.body;
      console.log('🔔 OC: Received Rafiki webhook:', {
        id: webhook.id,
        type: webhook.type,
        dataId: webhook.data?.id,
        walletAddressId: webhook.data?.walletAddressId
      });

      // Validate webhook structure
      if (!webhook.id || !webhook.type || !webhook.data) {
        console.error('❌ OC: Invalid webhook structure');
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid webhook structure' }
        });
      }

      // Forward webhook to Core Banking Service
      const cbsWebhookUrl = `${process.env.CORE_BANKING_URL}/webhooks/rafiki`;
      console.log('📤 OC: Forwarding webhook to CBS:', cbsWebhookUrl);

      const forwardResponse = await axios.post(cbsWebhookUrl, {
        ...webhook,
        forwardedBy: 'oc-service',
        forwardedAt: new Date().toISOString(),
        originalSource: 'rafiki'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-By': 'oc-service',
          'X-Original-Source': 'rafiki'
        },
        timeout: 10000
      });

      if (forwardResponse.status >= 200 && forwardResponse.status < 300) {
        console.log('✅ OC: Webhook successfully forwarded to CBS');
        return res.status(200).json({
          success: true,
          message: 'Webhook received and forwarded to CBS',
          webhookId: webhook.id,
          forwardedTo: 'core-banking-service'
        });
      } else {
        console.error('❌ OC: CBS webhook forwarding failed:', forwardResponse.status);
        return res.status(502).json({
          success: false,
          error: { message: 'Failed to forward webhook to CBS' }
        });
      }

    } catch (error: any) {
      console.error('❌ OC: Error processing webhook:', error.message);
      
      // If it's a network error to CBS, still acknowledge the webhook
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.log('⚠️ OC: CBS unreachable, acknowledging webhook anyway');
        return res.status(200).json({
          success: false,
          message: 'Webhook received but CBS unreachable',
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to process webhook' }
      });
    }
  }

  /**
   * Get webhook forwarding statistics
   */
  static async getWebhookStats(req: Request, res: Response) {
    try {
      // This could be enhanced with actual statistics tracking
      const stats = {
        serviceName: 'oc-service',
        role: 'webhook-forwarder',
        uptime: process.uptime(),
        lastForwarded: new Date().toISOString(),
        status: 'active'
      };

      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('❌ OC: Error getting webhook stats:', error.message);
      return res.status(500).json({
        success: false,
        error: { message: error.message }
      });
    }
  }
}

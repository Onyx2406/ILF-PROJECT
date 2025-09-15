interface WebhookEvent {
  id: string;
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
  walletAddressId?: string;
  accountId?: string;
  status: 'received' | 'processed' | 'error';
  forwardedBy?: string;
  forwardedAt?: string;
  originalSource?: string;
  resourceId?: string;
  createdAt?: string;
}

// Global webhook storage
let webhooks: WebhookEvent[] = [];

export const webhookStore = {
  addWebhook: (webhook: WebhookEvent) => {
    webhooks.unshift(webhook);
    // Keep last 200 webhooks
    if (webhooks.length > 200) {
      webhooks = webhooks.slice(0, 200);
    }
    console.log(`📋 Webhook store: Added webhook ${webhook.id}, total: ${webhooks.length}`);
  },
  
  getWebhooks: (limit?: number): WebhookEvent[] => {
    return limit ? webhooks.slice(0, limit) : webhooks;
  },
  
  getWebhooksByType: (type: string): WebhookEvent[] => {
    return webhooks.filter(webhook => webhook.type === type);
  },
  
  getWebhooksByStatus: (status: WebhookEvent['status']): WebhookEvent[] => {
    return webhooks.filter(webhook => webhook.status === status);
  },
  
  updateWebhookStatus: (id: string, status: WebhookEvent['status']) => {
    const webhook = webhooks.find(w => w.id === id);
    if (webhook) {
      webhook.status = status;
      console.log(`📋 Webhook store: Updated webhook ${id} status to ${status}`);
    }
  },
  
  clearWebhooks: () => {
    webhooks = [];
    console.log('📋 Webhook store: Cleared all webhooks');
  },
  
  getWebhookCount: (): number => {
    return webhooks.length;
  },
  
  getWebhookStats: () => {
    const total = webhooks.length;
    const byStatus = {
      received: webhooks.filter(w => w.status === 'received').length,
      processed: webhooks.filter(w => w.status === 'processed').length,
      error: webhooks.filter(w => w.status === 'error').length
    };
    const byType = webhooks.reduce((acc, webhook) => {
      acc[webhook.type] = (acc[webhook.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total,
      byStatus,
      byType,
      lastWebhook: webhooks[0]?.timestamp || null
    };
  }
};

export type { WebhookEvent };

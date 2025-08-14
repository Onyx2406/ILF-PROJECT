interface WebhookEvent {
  id: string;
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
  walletAddressId?: string;
  accountId?: string;
  status: 'received' | 'processed' | 'error';
}

// Global webhook storage
let webhooks: WebhookEvent[] = [];

export const webhookStore = {
  addWebhook: (webhook: WebhookEvent) => {
    webhooks.unshift(webhook);
    if (webhooks.length > 100) {
      webhooks = webhooks.slice(0, 100);
    }
  },
  
  getWebhooks: (): WebhookEvent[] => {
    return webhooks;
  },
  
  clearWebhooks: () => {
    webhooks = [];
  },
  
  getWebhookCount: (): number => {
    return webhooks.length;
  }
};

export type { WebhookEvent };

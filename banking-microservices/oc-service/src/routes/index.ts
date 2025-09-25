import express from 'express';
import { RequestController } from '../controllers/requestController';
import { RafikiController } from '../controllers/rafikiController';
import { WebhookController } from '../controllers/webhookController';

const router = express.Router();

// Health check
router.get('/health', RequestController.healthCheck);

// Queue management
router.get('/queue/stats', RequestController.getStats);
router.get('/queue/requests', RequestController.getAllRequests);
router.get('/queue/requests/:requestId', RequestController.getRequestById);
router.delete('/queue/history', RequestController.clearHistory);

// Service status
router.get('/services/status', RequestController.getServiceStatus);

// Rafiki service endpoints
router.post('/rafiki/wallet', RafikiController.createWallet);

// Webhook endpoints
router.post('/webhooks/rafiki', WebhookController.receiveRafikiWebhook);
router.get('/webhooks/stats', WebhookController.getWebhookStats);

// Request forwarding
router.all('/forward/:destination', RequestController.forwardRequest);
router.all('/quick/:service/*', RequestController.quickForward);

// Banking specific routes (commonly used)
router.post('/banking/customers', (req, res) => {
  // Forward to core banking service
  RequestController.forwardToService(req, res, 'core-banking', '/customers');
});

router.get('/banking/customers/:id', (req, res) => {
  // Forward to core banking service
  RequestController.forwardToService(req, res, 'core-banking', `/customers/${req.params.id}`);
});

router.post('/banking/customers/:id/accounts', (req, res) => {
  // Forward to core banking service
  RequestController.forwardToService(req, res, 'core-banking', `/customers/${req.params.id}/accounts`);
});

router.get('/banking/accounts', (req, res) => {
  // Forward to core banking service
  RequestController.forwardToService(req, res, 'core-banking', '/accounts');
});

router.post('/banking/wallets', (req, res) => {
  // Forward wallet creation to core banking service
  RequestController.forwardToService(req, res, 'core-banking', '/wallets');
});

router.get('/banking/wallets', (req, res) => {
  // Forward wallet list request to core banking service
  RequestController.forwardToService(req, res, 'core-banking', '/wallets');
});

export default router;

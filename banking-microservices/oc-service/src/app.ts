import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { forwarderService } from './services/forwarderService';
import requestRoutes from './routes/index';

const app = express();
const PORT = process.env.PORT || 3300;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for development
}));
app.use(cors({
  origin: '*', // Allow all origins for development
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// API Routes
app.use('/api', requestRoutes);

// Serve admin UI (static files if available)
const adminUIPath = path.join(__dirname, '../admin-ui/dist');
app.use('/admin', express.static(adminUIPath));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'OC Service (Orchestration Controller)',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      api: '/api',
      admin: '/admin',
      health: '/api/health',
      stats: '/api/queue/stats',
      requests: '/api/queue/requests'
    },
    documentation: {
      forward: 'POST /api/forward/{destination}?endpoint={path}',
      quick: 'ALL /api/quick/{service}/{path}',
      banking: {
        customers: 'POST /api/banking/customers',
        getCustomer: 'GET /api/banking/customers/{id}',
        createAccount: 'POST /api/banking/customers/{id}/accounts',
        getAccounts: 'GET /api/banking/accounts'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/queue/stats',
      'POST /api/forward/{destination}',
      'ALL /api/quick/{service}/{path}'
    ]
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start forwarder service
forwarderService.startProcessing();

app.listen(PORT, () => {
  console.log('🚀 OC Service (Orchestration Controller) started');
  console.log(`📊 Server running on port ${PORT}`);
  console.log(`🔗 API Endpoint: http://localhost:${PORT}/api`);
  console.log(`📈 Admin UI: http://localhost:${PORT}/admin`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('Available Services:');
  console.log('- Core Banking: PORT 3200');
  console.log('- Internet Banking: PORT 3100'); 
  console.log('- OC Service: PORT 3300');
});

export default app;

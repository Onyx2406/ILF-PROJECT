const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432'),
  user: process.env.PGUSER || process.env.DB_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
  database: process.env.PGDATABASE || process.env.DB_NAME || 'abl_cbs',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const db = new Pool(dbConfig);

// IBAN Generator
function generateIBAN() {
  const bankCode = 'ABBL';
  const accountNumber = generateAccountNumber();
  const checkDigits = calculateCheckDigits(bankCode + accountNumber);
  return `PK${checkDigits}${bankCode}${accountNumber}`;
}

function generateAccountNumber() {
  let accountNumber = '';
  for (let i = 0; i < 16; i++) {
    accountNumber += Math.floor(Math.random() * 10).toString();
  }
  return accountNumber;
}

function calculateCheckDigits(accountPart) {
  let numericString = '';
  
  for (const char of accountPart) {
    if (char >= 'A' && char <= 'Z') {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      numericString += char;
    }
  }
  
  numericString += '252000';
  
  let remainder = 0;
  for (const digit of numericString) {
    remainder = (remainder * 10 + parseInt(digit)) % 97;
  }
  
  const checkDigits = 98 - remainder;
  return checkDigits.toString().padStart(2, '0');
}

// Initialize database
async function initializeDatabase() {
  try {
    const client = await db.connect();
    console.log('✅ Database connected successfully');
    client.release();

    // Tables are created by init.sql in Docker
    // await createTables();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function createTables() {
  const client = await db.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        iban VARCHAR(24) UNIQUE NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        balance DECIMAL(15,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_pointers (
        id SERIAL PRIMARY KEY,
        url VARCHAR(255) NOT NULL,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
        description TEXT,
        reference VARCHAR(100),
        status VARCHAR(20) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id SERIAL PRIMARY KEY,
        url VARCHAR(255) NOT NULL,
        events JSONB NOT NULL,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        secret VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ilp_active_accounts (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        wallet_address_id VARCHAR(255) NOT NULL,
        wallet_address_url VARCHAR(255) NOT NULL,
        public_name VARCHAR(255),
        asset_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Create Express app
async function startServer() {
  try {
    await initializeDatabase();
    
    const app = express();
    const PORT = process.env.PORT || 8101;

    // Middleware
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(cors({
      origin: [
        'http://localhost:3000', 
        'http://localhost:3050', 
        'http://localhost:8100', 
        'http://localhost:3200',
        'http://abl-frontend:3000'
      ],
      credentials: true
    }));
    app.use(morgan('combined'));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({
        service: 'ABL Core Banking Service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'connected'
      });
    });

    // Account routes
    // CREATE - Create new account (already exists)
    app.post('/api/accounts', async (req, res) => {
      try {
        const { name, email } = req.body;
        const iban = generateIBAN();
        
        const result = await db.query(
          'INSERT INTO accounts (name, email, iban, currency) VALUES ($1, $2, $3, $4) RETURNING *',
          [name, email, iban, 'PKR'] // Default to PKR for Pakistani bank
        );

        res.status(201).json({ success: true, data: result.rows[0] });
      } catch (error) {
        console.error('Error creating account:', error);
        
        if (error.code === '23505') {
          res.status(400).json({ success: false, error: { message: 'Email already exists' } });
          return;
        }
        
        res.status(500).json({ success: false, error: { message: 'Failed to create account' } });
      }
    });

    // READ - Get all accounts (already exists)
    app.get('/api/accounts', async (req, res) => {
      try {
        const result = await db.query(`
          SELECT 
            id,
            name,
            email,
            iban,
            currency,
            balance,
            status,
            wallet_address_id,
            wallet_address_url,
            wallet_public_name,
            asset_id,
            created_at,
            updated_at
          FROM accounts 
          ORDER BY created_at DESC
        `);

        res.json({ success: true, data: result.rows });
      } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch accounts' } });
      }
    });

    // READ - Get single account by ID
    app.get('/api/accounts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        const result = await db.query(`
          SELECT 
            id,
            name,
            email,
            iban,
            currency,
            balance,
            status,
            wallet_address_id,
            wallet_address_url,
            wallet_public_name,
            asset_id,
            created_at,
            updated_at
          FROM accounts 
          WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: { message: 'Account not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
      } catch (error) {
        console.error('Error fetching account:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch account' } });
      }
    });

    // UPDATE - Update account details
    app.put('/api/accounts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { name, email, status } = req.body;
        
        // Validate required fields
        if (!name || !email) {
          return res.status(400).json({ 
            success: false, 
            error: { message: 'Name and email are required' } 
          });
        }

        const result = await db.query(
          `UPDATE accounts 
           SET name = $1, 
               email = $2, 
               status = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4 
           RETURNING *`,
          [name, email, status || 'active', id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: { message: 'Account not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
      } catch (error) {
        console.error('Error updating account:', error);
        if (error.code === '23505') { // Unique constraint violation
          res.status(409).json({ success: false, error: { message: 'Email already exists' } });
        } else {
          res.status(500).json({ success: false, error: { message: 'Failed to update account' } });
        }
      }
    });

    // PARTIAL UPDATE - Update specific fields
    app.patch('/api/accounts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        
        // Build dynamic query
        const updateFields = [];
        const values = [];
        let paramCount = 1;

        // Add id as last parameter
        values.push(id);
        const idParam = paramCount++;

        // Build SET clause dynamically
        for (const [key, value] of Object.entries(updates)) {
          if (['name', 'email', 'status', 'balance'].includes(key)) {
            updateFields.push(`${key} = $${paramCount}`);
            values.unshift(value); // Add to beginning, id stays last
            paramCount++;
          }
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: { message: 'No valid fields to update' } 
          });
        }

        // Adjust parameter positions
        const adjustedValues = [];
        for (let i = 0; i < updateFields.length; i++) {
          adjustedValues.push(values[i]);
        }
        adjustedValues.push(id); // id goes last

        const query = `
          UPDATE accounts 
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramCount - 1}
          RETURNING *
        `;

        const result = await db.query(query, adjustedValues);

        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: { message: 'Account not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
      } catch (error) {
        console.error('Error partially updating account:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to update account' } });
      }
    });

    // UPDATE - Update account wallet information (already exists)
    app.patch('/api/accounts/:id/wallet', async (req, res) => {
      try {
        const { id } = req.params;
        const { wallet_address_id, wallet_address_url, wallet_public_name, asset_id } = req.body;

        console.log('🔄 Updating account with wallet data:', {
          id,
          wallet_address_id,
          wallet_address_url,
          wallet_public_name,
          asset_id
        });

        // Force new prepared statement by adding a comment
        const updateQuery = `
          UPDATE accounts 
          SET wallet_address_id = $1, 
              wallet_address_url = $2, 
              wallet_public_name = $3, 
              asset_id = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 
          RETURNING * -- Force new prepared statement
        `;

        console.log('📋 SQL Query:', updateQuery);
        console.log('📋 Parameters:', [wallet_address_id, wallet_address_url, wallet_public_name, asset_id, id]);

        const result = await db.query(updateQuery, [
          wallet_address_id,
          wallet_address_url,
          wallet_public_name,
          asset_id,
          id  // This is parameter $5
        ]);

        if (result.rows.length === 0) {
          console.log('❌ No account found with ID:', id);
          return res.status(404).json({
            success: false,
            error: { message: 'Account not found' }
          });
        }

        console.log('✅ Account updated successfully with wallet data:', result.rows[0]);
        res.json({
          success: true,
          data: result.rows[0]
        });

      } catch (error) {
        console.error('Error updating account wallet:', error);
        res.status(500).json({
          success: false,
          error: { message: 'Internal server error' }
        });
      }
    });

    // DELETE - Soft delete account (set status to 'deleted')
    app.delete('/api/accounts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        // Soft delete - just change status
        const result = await db.query(
          `UPDATE accounts 
           SET status = 'deleted', 
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND status != 'deleted'
           RETURNING *`,
          [id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ 
            success: false, 
            error: { message: 'Account not found or already deleted' } 
          });
        }

        res.json({ 
          success: true, 
          message: 'Account deleted successfully',
          data: result.rows[0] 
        });
      } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to delete account' } });
      }
    });

    // HARD DELETE - Permanently delete account (optional, dangerous)
    app.delete('/api/accounts/:id/permanent', async (req, res) => {
      try {
        const { id } = req.params;
        
        const result = await db.query(
          'DELETE FROM accounts WHERE id = $1 RETURNING *',
          [id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: { message: 'Account not found' } });
        }

        res.json({ 
          success: true, 
          message: 'Account permanently deleted',
          data: result.rows[0] 
        });
      } catch (error) {
        console.error('Error permanently deleting account:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to permanently delete account' } });
      }
    });

    // GET - Get all accounts with payment pointers/wallet addresses
    app.get('/api/payment-pointers', async (req, res) => {
      try {
        console.log('📋 Fetching all payment pointers...');
        
        const result = await db.query(`
          SELECT 
            id,
            name,
            email,
            iban,
            wallet_address_id,
            wallet_address_url,
            wallet_public_name,
            asset_id,
            status,
            created_at,
            updated_at
          FROM accounts 
          WHERE wallet_address_id IS NOT NULL 
            AND wallet_address_url IS NOT NULL
            AND status = 'active'
          ORDER BY updated_at DESC
        `);

        console.log(`📋 Found ${result.rows.length} accounts with payment pointers`);

        res.json({ 
          success: true, 
          data: result.rows,
          count: result.rows.length 
        });
      } catch (error) {
        console.error('Error fetching payment pointers:', error);
        res.status(500).json({ 
          success: false, 
          error: { message: 'Failed to fetch payment pointers' } 
        });
      }
    });

    // GET - Get payment pointer details by account ID
    app.get('/api/payment-pointers/:id', async (req, res) => {
      try {
        const { id } = req.params;
        console.log(`📋 Fetching payment pointer for account ID: ${id}`);
        
        const result = await db.query(`
          SELECT 
            id,
            name,
            email,
            iban,
            wallet_address_id,
            wallet_address_url,
            wallet_public_name,
            asset_id,
            status,
            created_at,
            updated_at
          FROM accounts 
          WHERE id = $1 
            AND wallet_address_id IS NOT NULL 
            AND wallet_address_url IS NOT NULL
        `, [id]);

        if (result.rows.length === 0) {
          console.log(`❌ Payment pointer not found for account ID: ${id}`);
          return res.status(404).json({ 
            success: false, 
            error: { message: 'Payment pointer not found' } 
          });
        }

        console.log(`✅ Found payment pointer for account: ${result.rows[0].name}`);
        res.json({ success: true, data: result.rows[0] });
      } catch (error) {
        console.error('Error fetching payment pointer:', error);
        res.status(500).json({ 
          success: false, 
          error: { message: 'Failed to fetch payment pointer' } 
        });
      }
    });

    // DELETE - Remove payment pointer (set wallet fields to null)
    app.delete('/api/payment-pointers/:id', async (req, res) => {
      try {
        const { id } = req.params;
        console.log(`🗑️ Removing payment pointer for account ID: ${id}`);
        
        const result = await db.query(`
          UPDATE accounts 
          SET wallet_address_id = NULL,
              wallet_address_url = NULL,
              wallet_public_name = NULL,
              asset_id = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 
            AND wallet_address_id IS NOT NULL
          RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
          console.log(`❌ Payment pointer not found for account ID: ${id}`);
          return res.status(404).json({ 
            success: false, 
            error: { message: 'Payment pointer not found' } 
          });
        }

        console.log(`✅ Removed payment pointer for account: ${result.rows[0].name}`);
        res.json({ 
          success: true, 
          message: 'Payment pointer removed successfully',
          data: result.rows[0] 
        });
      } catch (error) {
        console.error('Error removing payment pointer:', error);
        res.status(500).json({ 
          success: false, 
          error: { message: 'Failed to remove payment pointer' } 
        });
      }
    });

    // 404 handler for API routes
    // app.all('/api/*', (req, res) => {
    //   res.status(404).json({
    //     success: false,
    //     error: { message: 'API endpoint not found' }
    //   });
    // });

    // Error handling
    app.use((error, req, res, next) => {
      console.error('ABL CBS Error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: { message: error.message || 'Internal Server Error' }
      });
    });

    app.listen(PORT, () => {
      console.log(`🏦 ABL Core Banking Service running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`✅ Database connected and tables created`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start ABL CBS:', error);
    process.exit(1);
  }
}

startServer();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const axios = require('axios');
const { createHmac } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const { v4: uuidv4 } = require('uuid');
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

// Rafiki GraphQL configuration - Happy Life Bank
const RAFIKI_CONFIG = {
  graphqlHost: 'http://localhost:4001',
  graphqlUrl: 'http://localhost:4001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d',
  assetId: 'b64f99cd-8b61-4c7f-9d73-cdd087e3d0ae', // USD asset ID from Happy Life Bank
  baseWalletUrl: 'https://abl-backend'
};

// Rafiki GraphQL Helper Functions
function generateBackendApiSignature(body) {
  const version = RAFIKI_CONFIG.backendApiSignatureVersion;
  const secret = RAFIKI_CONFIG.backendApiSignatureSecret;
  const timestamp = Date.now();
  const payload = `${timestamp}.${canonicalize(body)}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  
  return `t=${timestamp}, v${version}=${digest}`;
}

async function createWalletAddressInRafiki(accountData) {
  // Generate simple random ID using crypto for uniqueness
  const randomId = Math.random().toString(36).substring(2, 10);
  // Use simple account identifier that Rafiki accepts
  const walletAddress = `${RAFIKI_CONFIG.baseWalletUrl}/accounts/acc${accountData.id}`;
  
  const createWalletAddressQuery = `
    mutation CreateWalletAddress($input: CreateWalletAddressInput!) {
      createWalletAddress(input: $input) {
        walletAddress {
          id
          createdAt
          publicName
          address
          status
          asset {
            code
            createdAt
            id
            scale
            withdrawalThreshold
          }
          additionalProperties {
            key
            value
            visibleInOpenPayments
          }
        }
      }
    }
  `;

  const variables = {
    input: {
      assetId: RAFIKI_CONFIG.assetId,
      address: walletAddress,
      publicName: accountData.name || "Account Holder",
      additionalProperties: [
        {
          key: "iban", 
          value: accountData.iban, 
          visibleInOpenPayments: true
        },
        {
          key: "email", 
          value: accountData.email, 
          visibleInOpenPayments: false
        },
        {
          key: "account_id", 
          value: accountData.id.toString(), 
          visibleInOpenPayments: true
        }
      ]
    }
  };

  const requestBody = {
    query: createWalletAddressQuery,
    variables: variables
  };

  const signature = generateBackendApiSignature(requestBody);

  try {
    const response = await axios.post(RAFIKI_CONFIG.graphqlUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'signature': signature,
        'tenant-id': RAFIKI_CONFIG.senderTenantId
      },
      timeout: 10000
    });

    if (response.data.errors) {
      console.error('Rafiki GraphQL Errors:', response.data.errors);
      throw new Error(`Rafiki GraphQL Error: ${response.data.errors[0].message}`);
    }

    return response.data.data.createWalletAddress.walletAddress;
  } catch (error) {
    console.error('Error creating wallet address in Rafiki:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

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
    
    // Test the connection
    const result = await client.query('SELECT NOW()');
    console.log('📅 Database time:', result.rows[0].now);
    
    client.release();

    // Always create tables on startup
    console.log('🔄 Initializing database tables...');
    await createTables();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function createTables() {
  const client = await db.connect();
  
  try {
    console.log('🔄 Creating database tables...');
    
    // Check if database exists
    const dbCheck = await client.query('SELECT current_database()');
    console.log('📊 Connected to database:', dbCheck.rows[0].current_database);

    // 1. Create customers table first (no dependencies)
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        c_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(20),
        address TEXT,
        cnic VARCHAR(15) UNIQUE,
        dob DATE,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Customers table created');

    // 2. Drop existing accounts table if it has wrong schema
    await client.query('DROP TABLE IF EXISTS accounts CASCADE');
    console.log('🗑️ Dropped existing accounts table');

    // 3. Create accounts table with new schema (no unique constraint on email, account_type, currency)
    await client.query(`
      CREATE TABLE accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        iban VARCHAR(24) UNIQUE NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        balance DECIMAL(15,2) DEFAULT 0.00,
        account_type VARCHAR(50) DEFAULT 'SAVINGS',
        status VARCHAR(20) DEFAULT 'active',
        wallet_address_id VARCHAR(255),
        wallet_address_url VARCHAR(255),
        wallet_public_name VARCHAR(255),
        asset_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Accounts table created with new schema');

    // 4. Create relationship table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rel_customer_accounts (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(c_id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        relationship_type VARCHAR(50) DEFAULT 'PRIMARY',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, account_id)
      )
    `);
    console.log('✅ Customer-Account relationship table created');

    // 5. Create transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
        amount DECIMAL(15,2) NOT NULL,
        balance_before DECIMAL(15,2),
        balance_after DECIMAL(15,2),
        description TEXT,
        reference VARCHAR(100),
        status VARCHAR(20) DEFAULT 'COMPLETED',
        related_account_id INTEGER REFERENCES accounts(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Transactions table created');

    // 6. Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_accounts_email_type_currency ON accounts(email, account_type, currency)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_accounts_iban ON accounts(iban)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_rel_customer_accounts_customer_id ON rel_customer_accounts(customer_id)');
    console.log('✅ Database indexes created');

    // 7. Insert sample customer if none exist
    const customerCount = await client.query('SELECT COUNT(*) FROM customers');
    if (parseInt(customerCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO customers (name, email, phone_number, address, cnic, dob) 
        VALUES 
          ('Sohaib Sarosh Shamsi', 'sohaib1083@gmail.com', '+92-300-1234567', 'Karachi, Pakistan', '42101-1234567-1', '1990-01-15')
        ON CONFLICT (email) DO NOTHING
      `);
      console.log('✅ Sample customer inserted');
    }

    console.log('✅ All database tables created successfully');
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

    // UPDATE - Create wallet address in Rafiki and update account
    app.patch('/api/accounts/:id/wallet', async (req, res) => {
      try {
        const { id } = req.params;
        const { wallet_public_name, asset_id } = req.body;

        console.log('🔄 Creating wallet address in Rafiki for account:', {
          id,
          wallet_public_name,
          asset_id
        });

        // First, get the account details to create the wallet address
        const accountQuery = `
          SELECT 
            id,
            name,
            email,
            iban,
            currency,
            account_type
          FROM accounts 
          WHERE id = $1
        `;

        const accountResult = await db.query(accountQuery, [id]);

        if (accountResult.rows.length === 0) {
          console.log('❌ No account found with ID:', id);
          return res.status(404).json({
            success: false,
            error: { message: 'Account not found' }
          });
        }

        const accountData = accountResult.rows[0];
        console.log('📋 Account data for wallet creation:', accountData);

        // Create wallet address in Rafiki
        console.log('🌐 Creating wallet address in Rafiki...');
        const rafikiWallet = await createWalletAddressInRafiki(accountData);
        
        console.log('✅ Rafiki wallet address created:', {
          id: rafikiWallet.id,
          address: rafikiWallet.address,
          publicName: rafikiWallet.publicName,
          status: rafikiWallet.status
        });

        // Update the account with Rafiki wallet information
        const updateQuery = `
          UPDATE accounts 
          SET wallet_address_id = $1, 
              wallet_address_url = $2, 
              wallet_public_name = $3, 
              asset_id = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 
          RETURNING *
        `;

        const updateResult = await db.query(updateQuery, [
          rafikiWallet.id,
          rafikiWallet.address,
          rafikiWallet.publicName,
          RAFIKI_CONFIG.assetId,
          id
        ]);

        console.log('✅ Account updated successfully with Rafiki wallet data:', updateResult.rows[0]);
        
        // Return the updated account with additional Rafiki data
        res.json({
          success: true,
          data: {
            ...updateResult.rows[0],
            rafiki_wallet: {
              id: rafikiWallet.id,
              address: rafikiWallet.address,
              publicName: rafikiWallet.publicName,
              status: rafikiWallet.status,
              createdAt: rafikiWallet.createdAt,
              asset: rafikiWallet.asset,
              additionalProperties: rafikiWallet.additionalProperties
            }
          }
        });

      } catch (error) {
        console.error('❌ Error creating wallet address in Rafiki:', error);
        
        // Check if it's a Rafiki-specific error
        if (error.message.includes('Rafiki GraphQL Error')) {
          return res.status(400).json({
            success: false,
            error: { 
              message: 'Failed to create wallet address in Rafiki', 
              details: error.message 
            }
          });
        }

        // Generic error
        res.status(500).json({
          success: false,
          error: { 
            message: 'Internal server error',
            details: error.message 
          }
        });
      }
    });

    // DELETE - Hard delete account (permanently remove from database)
    app.delete('/api/accounts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        // Hard delete - permanently remove from database
        // Note: Database constraints will handle cascading deletes for related records
        const result = await db.query(
          'DELETE FROM accounts WHERE id = $1 RETURNING *',
          [id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ 
            success: false, 
            error: { message: 'Account not found' } 
          });
        }

        res.json({ 
          success: true, 
          message: 'Account permanently deleted',
          data: result.rows[0] 
        });
      } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to delete account' } });
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

    // POST - Credit money to account (increase balance)
    app.post('/api/accounts/:id/credit', async (req, res) => {
      try {
        const { id } = req.params;
        const { amount, description, reference } = req.body;

        // Validate input
        if (!amount || amount <= 0) {
          return res.status(400).json({
            success: false,
            error: { message: 'Amount must be a positive number' }
          });
        }

        console.log(`💰 Processing credit for account ${id}:`, {
          amount,
          description,
          reference
        });

        // Start database transaction
        await db.query('BEGIN');

        try {
          // Get current account
          const accountResult = await db.query(
            'SELECT * FROM accounts WHERE id = $1 AND status = $2',
            [id, 'active']
          );

          if (accountResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({
              success: false,
              error: { message: 'Account not found or inactive' }
            });
          }

          const account = accountResult.rows[0];
          const currentBalance = parseFloat(account.balance);
          const creditAmount = parseFloat(amount);
          const newBalance = currentBalance + creditAmount;

          // Update account balance
          const updateResult = await db.query(`
            UPDATE accounts 
            SET balance = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 
            RETURNING *
          `, [newBalance.toFixed(2), id]);

          // Insert transaction record (if transactions table exists)
          try {
            await db.query(`
              INSERT INTO transactions (
                account_id, 
                type, 
                amount, 
                balance_before, 
                balance_after, 
                description, 
                reference, 
                status,
                created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            `, [
              id,
              'CREDIT',
              creditAmount.toFixed(2),
              currentBalance.toFixed(2),
              newBalance.toFixed(2),
              description || 'Account credit',
              reference || `CR-${Date.now()}`,
              'COMPLETED'
            ]);
          } catch (transError) {
            console.log('ℹ️ Transactions table not found, skipping transaction log');
          }

          // Commit transaction
          await db.query('COMMIT');

          console.log(`✅ Credit successful: ${account.name} credited ${creditAmount} ${account.currency}`);

          res.json({
            success: true,
            message: 'Credit processed successfully',
            data: {
              account: updateResult.rows[0],
              transaction: {
                type: 'CREDIT',
                amount: creditAmount,
                balance_before: currentBalance,
                balance_after: newBalance,
                description,
                reference: reference || `CR-${Date.now()}`
              }
            }
          });

        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }

      } catch (error) {
        console.error('Error processing credit:', error);
        res.status(500).json({
          success: false,
          error: { message: 'Failed to process credit' }
        });
      }
    });

    // POST - Debit money from account (decrease balance)
    app.post('/api/accounts/:id/debit', async (req, res) => {
      try {
        const { id } = req.params;
        const { amount, description, reference, allowOverdraft = false } = req.body;

        // Validate input
        if (!amount || amount <= 0) {
          return res.status(400).json({
            success: false,
            error: { message: 'Amount must be a positive number' }
          });
        }

        console.log(`💸 Processing debit for account ${id}:`, {
          amount,
          description,
          reference,
          allowOverdraft
        });

        // Start database transaction
        await db.query('BEGIN');

        try {
          // Get current account
          const accountResult = await db.query(
            'SELECT * FROM accounts WHERE id = $1 AND status = $2',
            [id, 'active']
          );

          if (accountResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({
              success: false,
              error: { message: 'Account not found or inactive' }
            });
          }

          const account = accountResult.rows[0];
          const currentBalance = parseFloat(account.balance);
          const debitAmount = parseFloat(amount);
          const newBalance = currentBalance - debitAmount;

          // Check for sufficient funds
          if (newBalance < 0 && !allowOverdraft) {
            await db.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: { 
                message: 'Insufficient funds',
                details: {
                  current_balance: currentBalance,
                  requested_amount: debitAmount,
                  shortage: Math.abs(newBalance)
                }
              }
            });
          }

          // Update account balance
          const updateResult = await db.query(`
            UPDATE accounts 
            SET balance = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 
            RETURNING *
          `, [newBalance.toFixed(2), id]);

          // Insert transaction record (if transactions table exists)
          try {
            await db.query(`
              INSERT INTO transactions (
                account_id, 
                type, 
                amount, 
                balance_before, 
                balance_after, 
                description, 
                reference, 
                status,
                created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            `, [
              id,
              'DEBIT',
              debitAmount.toFixed(2),
              currentBalance.toFixed(2),
              newBalance.toFixed(2),
              description || 'Account debit',
              reference || `DB-${Date.now()}`,
              'COMPLETED'  // Add the missing 8th parameter
            ]);
          } catch (transError) {
            console.log('ℹ️ Transactions table not found, skipping transaction log');
          }

          // Commit transaction
          await db.query('COMMIT');

          console.log(`✅ Debit successful: ${account.name} debited ${debitAmount} ${account.currency}`);

          res.json({
            success: true,
            message: 'Debit processed successfully',
            data: {
              account: updateResult.rows[0],
              transaction: {
                type: 'DEBIT',
                amount: debitAmount,
                balance_before: currentBalance,
                balance_after: newBalance,
                description,
                reference: reference || `DB-${Date.now()}`
              }
            }
          });

        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }

      } catch (error) {
        console.error('Error processing debit:', error);
        res.status(500).json({
          success: false,
          error: { message: 'Failed to process debit' }
        });
      }
    });

    // POST - Transfer money between accounts
    app.post('/api/accounts/transfer', async (req, res) => {
      try {
        const { 
          from_account_id, 
          to_account_id, 
          amount, 
          description, 
          reference 
        } = req.body;

        // Validate input
        if (!from_account_id || !to_account_id || !amount || amount <= 0) {
          return res.status(400).json({
            success: false,
            error: { message: 'Invalid transfer parameters' }
          });
        }

        if (from_account_id === to_account_id) {
          return res.status(400).json({
            success: false,
            error: { message: 'Cannot transfer to the same account' }
          });
        }

        console.log(`🔄 Processing transfer:`, {
          from: from_account_id,
          to: to_account_id,
          amount,
          description,
          reference
        });

        // Start database transaction
        await db.query('BEGIN');

        try {
          // Get both accounts
          const accountsResult = await db.query(
            'SELECT * FROM accounts WHERE id IN ($1, $2) AND status = $3',
            [from_account_id, to_account_id, 'active']
          );

          if (accountsResult.rows.length !== 2) {
            await db.query('ROLLBACK');
            return res.status(404).json({
              success: false,
              error: { message: 'One or both accounts not found or inactive' }
            });
          }

          const fromAccount = accountsResult.rows.find(acc => acc.id == from_account_id);
          const toAccount = accountsResult.rows.find(acc => acc.id == to_account_id);

          const transferAmount = parseFloat(amount);
          const fromCurrentBalance = parseFloat(fromAccount.balance);
          const toCurrentBalance = parseFloat(toAccount.balance);

          // Check sufficient funds
          if (fromCurrentBalance < transferAmount) {
            await db.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: { 
                message: 'Insufficient funds in source account',
                details: {
                  available_balance: fromCurrentBalance,
                  requested_amount: transferAmount,
                  shortage: transferAmount - fromCurrentBalance
                }
              }
            });
          }

          const fromNewBalance = fromCurrentBalance - transferAmount;
          const toNewBalance = toCurrentBalance + transferAmount;
          const transferRef = reference || `TXN-${Date.now()}`;

          // Update from account (debit)
          await db.query(`
            UPDATE accounts 
            SET balance = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [fromNewBalance.toFixed(2), from_account_id]);

          // Update to account (credit)
          await db.query(`
            UPDATE accounts 
            SET balance = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [toNewBalance.toFixed(2), to_account_id]);

          // Commit transaction
          await db.query('COMMIT');

          console.log(`✅ Transfer successful: ${transferAmount} from ${fromAccount.name} to ${toAccount.name}`);

          res.json({
            success: true,
            message: 'Transfer completed successfully',
            data: {
              transfer_reference: transferRef,
              amount: transferAmount,
              from_account: {
                id: from_account_id,
                name: fromAccount.name,
                balance_before: fromCurrentBalance,
                balance_after: fromNewBalance
              },
              to_account: {
                id: to_account_id,
                name: toAccount.name,
                balance_before: toCurrentBalance,
                balance_after: toNewBalance
              }
            }
          });

        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }

      } catch (error) {
        console.error('Error processing transfer:', error);
        res.status(500).json({
          success: false,
          error: { message: 'Failed to process transfer' }
        });
      }
    });

    // GET - Get account transactions
    app.get('/api/accounts/:id/transactions', async (req, res) => {
      try {
        const { id } = req.params;
        const { page = 1, limit = 10, type } = req.query;
        
        const offset = (page - 1) * limit;
        
        let query = `
          SELECT 
            t.*,
            ra.name as related_account_name,
            ra.iban as related_account_iban
          FROM transactions t
          LEFT JOIN accounts ra ON t.related_account_id = ra.id
          WHERE t.account_id = $1
        `;
        
        const params = [id];
        
        if (type) {
          query += ` AND t.type = $2`;
          params.push(type.toUpperCase());
        }
        
        query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM transactions WHERE account_id = $1';
        const countParams = [id];
        
        if (type) {
          countQuery += ' AND type = $2';
          countParams.push(type.toUpperCase());
        }
        
        const countResult = await db.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);

        console.log(`📊 Retrieved ${result.rows.length} transactions for account ${id}`);

        res.json({
          success: true,
          data: result.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        });

      } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
          success: false,
          error: { message: 'Failed to fetch transactions' }
        });
      }
    });

    // ==============================================================
    // CUSTOMER MANAGEMENT ROUTES
    // ==============================================================

    // CREATE - Create new customer
    app.post('/api/customers', async (req, res) => {
      try {
        const { name, email, phone_number, address, cnic, dob } = req.body;
        
        // Validate required fields
        if (!name || !email) {
          return res.status(400).json({
            success: false,
            error: { message: 'Name and email are required' }
          });
        }

        console.log('🧑‍💼 Creating new customer:', { name, email, phone_number, cnic });

        const result = await db.query(
          `INSERT INTO customers (name, email, phone_number, address, cnic, dob) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING *`,
          [name, email, phone_number, address, cnic, dob]
        );

        console.log('✅ Customer created successfully:', result.rows[0]);
        res.status(201).json({ success: true, data: result.rows[0] });
      } catch (error) {
        console.error('Error creating customer:', error);
        
        if (error.code === '23505') { // Unique constraint violation
          const field = error.constraint.includes('email') ? 'email' : 'CNIC';
          res.status(400).json({ 
            success: false, 
            error: { message: `Customer with this ${field} already exists` } 
          });
          return;
        }
        
        res.status(500).json({ 
          success: false, 
          error: { message: 'Failed to create customer' } 
        });
      }
    });

    // READ - Get all customers
    app.get('/api/customers', async (req, res) => {
      try {
        const { page = 1, limit = 50, search, status } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let query = `
          SELECT 
            c.c_id,
            c.name,
            c.email,
            c.phone_number,
            c.address,
            c.cnic,
            c.dob,
            c.status,
            c.created_at,
            c.updated_at,
            COUNT(a.id) as account_count
          FROM customers c
          LEFT JOIN rel_customer_accounts rca ON c.c_id = rca.customer_id
          LEFT JOIN accounts a ON rca.account_id = a.id
        `;
        
        const params = [];
        let paramCount = 1;
        let whereConditions = [];

        // Only filter by status if explicitly provided
        if (status) {
          whereConditions.push(`c.status = $${paramCount}`);
          params.push(status);
          paramCount++;
        }
        // No need to filter DELETED customers since we're doing hard deletes

        if (search) {
          whereConditions.push(`(c.name ILIKE $${paramCount} OR c.email ILIKE $${paramCount} OR cnic ILIKE $${paramCount})`);
          params.push(`%${search}%`);
          paramCount++;
        }

        // Add WHERE clause if we have conditions
        if (whereConditions.length > 0) {
          query += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        query += ` 
          GROUP BY c.c_id, c.name, c.email, c.phone_number, c.address, c.cnic, c.dob, c.status, c.created_at, c.updated_at
          ORDER BY c.created_at DESC 
          LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        params.push(limitNum, offset);

        console.log('📋 Customer query:', query);
        console.log('📋 Query params:', params);

        const result = await db.query(query, params);

        console.log(`📋 Retrieved ${result.rows.length} customers`);

        res.json({
          success: true,
          data: result.rows,
          count: result.rows.length
        });
      } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ 
          success: false, 
          error: { message: 'Failed to fetch customers' } 
        });
      }
    });

    // DEBUG - Get all customers without filtering (MOVE THIS UP)
    app.get('/api/debug/customers', async (req, res) => {
      try {
        console.log('🔍 Debug: Fetching ALL customers...');
        
        const result = await db.query(`
          SELECT 
            c_id,
            name,
            email,
            status,
            created_at
          FROM customers 
          ORDER BY created_at DESC
        `);

        console.log(`🔍 Debug: Found ${result.rows.length} total customers in database`);
        console.log('🔍 Debug: Customer data:', result.rows);

        res.json({
          success: true,
          data: result.rows,
          count: result.rows.length,
          debug: true
        });
      } catch (error) {
        console.error('Error in debug query:', error);
        res.status(500).json({ 
          success: false, 
          error: { message: 'Debug query failed' } 
        });
      }
    });

    // READ - Get single customer by ID
    app.get('/api/customers/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        console.log(`📋 Fetching customer ${id} details...`);
        
        // Get customer details
        const customerResult = await db.query(
          'SELECT * FROM customers WHERE c_id = $1',
          [id]
        );

        if (customerResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { message: 'Customer not found' }
          });
        }

        console.log(`✅ Found customer: ${customerResult.rows[0].name}`);
        res.json({ success: true, data: customerResult.rows[0] });
      } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ 
          success: false, 
          error: { message: 'Failed to fetch customer' } 
        });
      }
    });

    // GET customer's accounts
    app.get('/api/customers/:id/accounts', async (req, res) => {
      try {
        const { id } = req.params;
        
        console.log(`🏦 Fetching accounts for customer ${id}...`);
        
        // Get customer's accounts through relationship table
        const accountsResult = await db.query(`
          SELECT 
            a.*,
            rca.relationship_type,
            rca.created_at as relationship_created_at
          FROM accounts a
          INNER JOIN rel_customer_accounts rca ON a.id = rca.account_id
          WHERE rca.customer_id = $1
          ORDER BY rca.created_at DESC
        `, [id]);

        console.log(`✅ Found ${accountsResult.rows.length} accounts for customer ${id}`);

        res.json({
          success: true,
          data: accountsResult.rows,
          count: accountsResult.rows.length
        });
      } catch (error) {
        console.error('Error fetching customer accounts:', error);
        res.status(500).json({ 
          success: false, 
          error: { message: 'Failed to fetch customer accounts' } 
        });
      }
    });

    // CREATE - Create account for customer
    app.post('/api/customers/:id/accounts', async (req, res) => {
      try {
        const { id: customer_id } = req.params;
        const { 
          name, 
          email, 
          currency = 'PKR', 
          initial_balance = '0.00',
          account_type = 'SAVINGS' // Add account type parameter
        } = req.body;
        
        console.log(`🏦 Creating ${account_type} account for customer ${customer_id}:`, { 
          name, email, currency, account_type 
        });

        // Start transaction
        await db.query('BEGIN');

        try {
          // Check if customer exists
          const customerCheck = await db.query(
            'SELECT * FROM customers WHERE c_id = $1 AND status = $2',
            [customer_id, 'active']
          );

          if (customerCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({
              success: false,
              error: { message: 'Customer not found or inactive' }
            });
          }

          const customer = customerCheck.rows[0];

          // REMOVED: No more duplicate account type checking - allow multiple accounts of same type

          // Create account with customer's email but make it unique per account type
          const iban = generateIBAN();
          const balance = parseFloat(initial_balance) || 0.00;
          
          // Use customer's email for the account
          const accountEmail = customer.email;
          const accountName = name || `${customer.name} - ${account_type} Account ${Date.now()}`;
          
          const accountResult = await db.query(
            `INSERT INTO accounts (name, email, iban, currency, balance, account_type) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [accountName, accountEmail, iban, currency, balance.toFixed(2), account_type]
          );

          const account = accountResult.rows[0];

          // Link customer to account in relationship table
          await db.query(
            'INSERT INTO rel_customer_accounts (customer_id, account_id, relationship_type) VALUES ($1, $2, $3)',
            [customer_id, account.id, 'PRIMARY']
          );

          await db.query('COMMIT');

          console.log(`✅ ${account_type} account created and linked to customer ${customer_id}:`, account);

          res.status(201).json({
            success: true,
            data: account,
            message: `${account_type} account created successfully for customer`
          });

        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }

      } catch (error) {
        console.error('Error creating account for customer:', error);
        
        if (error.code === '23505') {
          // Handle different unique constraint violations
          if (error.constraint === 'accounts_iban_key') {
            res.status(400).json({ 
              success: false, 
              error: { message: 'IBAN generation conflict, please try again' } 
            });
          } else {
            res.status(400).json({ 
              success: false, 
              error: { message: 'Account with this combination already exists' } 
            });
          }
        } else {
          res.status(500).json({ 
            success: false, 
            error: { message: 'Failed to create account' } 
          });
        }
      }
    });

    // UPDATE - Update customer details
    app.put('/api/customers/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { name, email, phone_number, address, cnic, dob, status } = req.body;
        
        if (!name || !email) {
          return res.status(400).json({ 
            success: false, 
            error: { message: 'Name and email are required' } 
          });
        }

        console.log(`🔄 Updating customer ${id}:`, { name, email, phone_number });

        const result = await db.query(
          `UPDATE customers 
           SET name = $1, email = $2, phone_number = $3, address = $4, 
               cnic = $5, dob = $6, status = $7, updated_at = CURRENT_TIMESTAMP
           WHERE c_id = $8 
           RETURNING *`,
          [name, email, phone_number, address, cnic, dob, status || 'active', id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ 
            success: false, 
            error: { message: 'Customer not found' } 
          });
        }

        console.log('✅ Customer updated successfully:', result.rows[0]);
        res.json({ success: true, data: result.rows[0] });
      } catch (error) {
        console.error('Error updating customer:', error);
        
        if (error.code === '23505') {
          const field = error.constraint.includes('email') ? 'email' : 'CNIC';
          res.status(409).json({ 
            success: false, 
            error: { message: `${field} already exists` } 
          });
        } else {
          res.status(500).json({ 
            success: false, 
            error: { message: 'Failed to update customer' } 
          });
        }
      }
    });

    // DELETE - Hard delete customer and all associated accounts
    app.delete('/api/customers/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        console.log(`🗑️ Hard deleting customer ${id} and all associated accounts`);

        // Start a transaction to ensure data consistency
        await db.query('BEGIN');

        try {
          // First check if customer exists
          const customerCheck = await db.query(
            'SELECT * FROM customers WHERE c_id = $1',
            [id]
          );

          if (customerCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ 
              success: false, 
              error: { message: 'Customer not found' } 
            });
          }

          const customer = customerCheck.rows[0];

          // Get all accounts associated with this customer
          const customerAccountsQuery = `
            SELECT a.id, a.name, a.iban, a.account_type 
            FROM accounts a
            INNER JOIN rel_customer_accounts rca ON a.id = rca.account_id
            WHERE rca.customer_id = $1
          `;
          const accountsResult = await db.query(customerAccountsQuery, [id]);
          const associatedAccounts = accountsResult.rows;

          console.log(`📋 Found ${associatedAccounts.length} accounts to delete for customer ${id}`);

          // Delete all transactions for these accounts first
          if (associatedAccounts.length > 0) {
            const accountIds = associatedAccounts.map(acc => acc.id);
            const deleteTransactionsQuery = `DELETE FROM transactions WHERE account_id = ANY($1)`;
            const transactionsResult = await db.query(deleteTransactionsQuery, [accountIds]);
            console.log(`🗑️ Deleted ${transactionsResult.rowCount} transactions`);
          }

          // Delete all relationship records (this will happen automatically due to CASCADE, but let's be explicit)
          const deleteRelationsResult = await db.query(
            'DELETE FROM rel_customer_accounts WHERE customer_id = $1',
            [id]
          );
          console.log(`🗑️ Deleted ${deleteRelationsResult.rowCount} customer-account relationships`);

          // Delete all associated accounts
          if (associatedAccounts.length > 0) {
            const accountIds = associatedAccounts.map(acc => acc.id);
            const deleteAccountsQuery = `DELETE FROM accounts WHERE id = ANY($1)`;
            const accountsDeleteResult = await db.query(deleteAccountsQuery, [accountIds]);
            console.log(`🗑️ Deleted ${accountsDeleteResult.rowCount} accounts`);
          }

          // Finally, delete the customer
          const result = await db.query(
            'DELETE FROM customers WHERE c_id = $1 RETURNING *',
            [id]
          );

          // Commit the transaction
          await db.query('COMMIT');

          console.log(`✅ Customer ${customer.name} and all associated data deleted successfully`);

          res.json({ 
            success: true, 
            message: `Customer and ${associatedAccounts.length} associated accounts deleted successfully`,
            data: {
              customer: result.rows[0],
              deleted_accounts: associatedAccounts.length,
              deleted_accounts_details: associatedAccounts
            }
          });

        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }

      } catch (error) {
        console.error('Error deleting customer:', error);
        
        // Handle foreign key constraint errors
        if (error.code === '23503') {
          res.status(400).json({ 
            success: false, 
            error: { message: 'Cannot delete customer: customer has associated data that cannot be removed' } 
          });
        } else {
          res.status(500).json({ 
            success: false, 
            error: { message: 'Failed to delete customer' } 
          });
        }
      }
    });

    // ==============================================================
    // END OF CUSTOMER MANAGEMENT ROUTES  
    // ==============================================================

    // DEBUG - Database relations endpoint
    app.get('/api/debug/relations', async (req, res) => {
      try {
        console.log('🔍 Fetching database relations...');
        
        // Get customers with account counts
        const customersQuery = `
          SELECT 
            c.c_id,
            c.name,
            c.email,
            c.status,
            COUNT(a.id) as account_count
          FROM customers c
          LEFT JOIN rel_customer_accounts rca ON c.c_id = rca.customer_id
          LEFT JOIN accounts a ON rca.account_id = a.id
          GROUP BY c.c_id, c.name, c.email, c.status
          ORDER BY c.c_id
        `;

        // Get detailed account relationships
        const relationsQuery = `
          SELECT 
            rca.id as relationship_id,
            rca.customer_id,
            c.name as customer_name,
            rca.account_id,
            a.name as account_name,
            a.iban,
            a.account_type,
            a.currency,
            a.balance,
            rca.relationship_type,
            rca.created_at as linked_at
          FROM rel_customer_accounts rca
          JOIN customers c ON rca.customer_id = c.c_id
          JOIN accounts a ON rca.account_id = a.id
          ORDER BY rca.customer_id, rca.account_id
        `;

        // Get transaction counts per account
        const transactionsQuery = `
          SELECT 
            a.id as account_id,
            a.name as account_name,
            COUNT(t.id) as transaction_count,
            SUM(CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE 0 END) as total_credits,
            SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE 0 END) as total_debits
          FROM accounts a
          LEFT JOIN transactions t ON a.id = t.account_id
          GROUP BY a.id, a.name
          ORDER BY a.id
        `;

        const [customersResult, relationsResult, transactionsResult] = await Promise.all([
          db.query(customersQuery),
          db.query(relationsQuery),
          db.query(transactionsQuery)
        ]);

        console.log(`✅ Relations data retrieved: ${customersResult.rows.length} customers, ${relationsResult.rows.length} relations`);

        res.json({
          success: true,
          data: {
            customers_summary: customersResult.rows,
            customer_account_relations: relationsResult.rows,
            account_transactions_summary: transactionsResult.rows,
            counts: {
              total_customers: customersResult.rows.length,
              total_relations: relationsResult.rows.length,
              total_accounts: transactionsResult.rows.length
            }
          }
        });

      } catch (error) {
        console.error('Error fetching relations:', error);
        res.status(500).json({ 
          success: false, 
          error: { message: 'Failed to fetch database relations' } 
        });
      }
    });

    console.log(`🚀 ABL Core Banking Service running on port ${PORT}`);
    console.log(`📋 Available at: http://localhost:${PORT}`);
    console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`👥 Customers API: http://localhost:${PORT}/api/customers`);
    console.log(`🏦 Accounts API: http://localhost:${PORT}/api/accounts`);
    
    // Start the Express server - THIS WAS MISSING!
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server started successfully on 0.0.0.0:${PORT}`);
      console.log(`🌐 Server listening on all interfaces`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Call the function to start the server
startServer();

import { Pool } from 'pg';

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

// Create a single instance to be reused
let pool: Pool | null = null;

export function getDatabase(): Pool {
  if (!pool) {
    pool = new Pool(dbConfig);
    
    // Test the connection
    pool.on('connect', () => {
      console.log('✅ Database connected successfully');
    });
    
    pool.on('error', (err) => {
      console.error('❌ Database connection error:', err);
    });
  }
  
  return pool;
}

// Database initialization
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  
  try {
    // Test connection
    await db.query('SELECT NOW()');
    console.log('✅ Database connection verified');
    
    // Create tables if they don't exist
    await createTables(db);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function createTables(db: Pool): Promise<void> {
  console.log('🔄 Initializing database tables...');
  
  try {
    console.log('🔄 Creating database tables...');
    
    // Get database name for confirmation
    const dbResult = await db.query('SELECT current_database()');
    console.log('📊 Connected to database:', dbResult.rows[0].current_database);

    // Create customers table
    await db.query(`
      CREATE TABLE IF NOT EXISTS customers (
        c_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
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

    // Create accounts table with Rafiki integration fields (if not exists)
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        iban VARCHAR(34) UNIQUE NOT NULL,
        currency VARCHAR(10) DEFAULT 'PKR',
        balance DECIMAL(15,2) DEFAULT 0.00,
        account_type VARCHAR(50) DEFAULT 'SAVINGS',
        status VARCHAR(50) DEFAULT 'active',
        wallet_address VARCHAR(255) NULL,
        wallet_id VARCHAR(255) NULL,
        asset_id VARCHAR(255) NULL,
        customer_id INTEGER REFERENCES customers(c_id),
        username VARCHAR(100) NULL,
        password_hash VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Accounts table created with new schema');

    // Create customer_accounts relationship table
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(c_id) ON DELETE CASCADE,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        relationship_type VARCHAR(50) DEFAULT 'primary',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, account_id)
      )
    `);
    console.log('✅ Customer-Account relationship table created');

    // Create transactions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        transaction_type VARCHAR(20) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'PKR',
        balance_after DECIMAL(15,2) NOT NULL,
        description TEXT,
        reference_number VARCHAR(100),
        related_account_id INTEGER REFERENCES accounts(id),
        status VARCHAR(20) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Transactions table created');

    // Create indexes for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
      CREATE INDEX IF NOT EXISTS idx_accounts_iban ON accounts(iban);
      CREATE INDEX IF NOT EXISTS idx_accounts_wallet_address ON accounts(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_accounts_wallet_id ON accounts(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_accounts_asset_id ON accounts(asset_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username) WHERE username IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
      CREATE INDEX IF NOT EXISTS idx_customers_cnic ON customers(cnic);
      CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_customer_accounts_customer_id ON customer_accounts(customer_id);
    `);
    console.log('✅ Database indexes created');

    console.log('✅ All database tables created successfully');
    
  } catch (error) {
    console.error('❌ Error creating database tables:', error);
    throw error;
  }
}

// IBAN generation utility
export function generateIBAN(): string {
  const bankCode = 'ABBL';
  const countryCode = 'PK';
  
  // Generate random account number (10 digits)
  const accountNumber = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
  
  // Generate random branch code (4 digits)  
  const branchCode = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  // Create IBAN without check digits
  const ibanWithoutCheck = `${countryCode}00${bankCode}${branchCode}${accountNumber}`;
  
  // Calculate check digits using mod-97 algorithm
  let numericString = '';
  for (let i = 4; i < ibanWithoutCheck.length; i++) {
    const char = ibanWithoutCheck[i];
    if (char >= '0' && char <= '9') {
      numericString += char;
    } else {
      // Convert letters to numbers (A=10, B=11, ..., Z=35)
      numericString += (char.charCodeAt(0) - 55).toString();
    }
  }
  
  // Add the country code numbers at the end
  numericString += '251610'; // PK00 -> 25 16 10
  
  // Calculate mod 97
  const remainder = BigInt(numericString) % BigInt(97);
  const checkDigits = (BigInt(98) - remainder).toString().padStart(2, '0');
  
  return `${countryCode}${checkDigits}${bankCode}${branchCode}${accountNumber}`;
}

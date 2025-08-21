-- ABL Core Banking System Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS ilp_active_accounts;
DROP TABLE IF EXISTS accounts;

-- Main accounts table with integrated wallet/ILP fields
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    iban VARCHAR(34) UNIQUE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'PKR', -- Keep but hidden from UI
    available_balance DECIMAL(15,2) DEFAULT 0.00, -- Available for use
    book_balance DECIMAL(15,2) DEFAULT 0.00,      -- Total including pending
    balance DECIMAL(15,2) DEFAULT 0.00,           -- Legacy field, will be same as available_balance
    account_type VARCHAR(50) DEFAULT 'SAVINGS',
    status VARCHAR(20) DEFAULT 'active',
    
    -- Internet Banking Credentials
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    
    -- Wallet/ILP fields (nullable - only populated after wallet creation)
    wallet_id VARCHAR(255) NULL,
    asset_id VARCHAR(255) NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_accounts_iban ON accounts(iban);
CREATE INDEX idx_accounts_username ON accounts(username);
CREATE INDEX idx_accounts_wallet_id ON accounts(wallet_address_id);
CREATE INDEX idx_accounts_asset_id ON accounts(asset_id);

-- Insert sample accounts (all with PKR currency by default)
INSERT INTO accounts (name, email, iban, currency, balance) VALUES
('John Doe', 'john.doe@example.com', 'PK38ABBL8050606062684308', 'PKR', 0.00),
('Sohaib Sarosh Shamsi', 'sohaib.sarosh.shamsi@example.com', 'PK04ABBL9949092366681203', 'PKR', 0.00),
('Database Test User', 'dbtest@example.com', 'PK70ABBL9434153926194065', 'PKR', 0.00),
('Zohair', 'zohair@example.com', 'PK31ABBL3687368539752782', 'PKR', 0.00),
('Abdullah Siddiqui', 'abdullah.siddiqui@example.com', 'PK28ABBL1900701457001594', 'PKR', 0.00),
('sohaib', 'sohaib1083@gmail.com', 'PK32ABBL3037725775832423', 'PKR', 0.00);


-- Add to your database initialization
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS wallet_address_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS wallet_address_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS wallet_public_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS asset_id VARCHAR(255);



-- Connect to your database and run these SQL commands

-- 1. Create customers table
CREATE TABLE IF NOT EXISTS customers (
    c_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    address TEXT,
    cnic VARCHAR(15) UNIQUE NOT NULL,
    dob DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create customer-account relationship table
CREATE TABLE IF NOT EXISTS customer_accounts (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(c_id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) DEFAULT 'primary',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, account_id)
);

-- 3. Add customer reference to accounts table (if not exists)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(c_id);

-- 4. Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL, -- CREDIT, DEBIT, TRANSFER
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
    original_amount DECIMAL(15,2), -- Original amount before conversion
    original_currency VARCHAR(3), -- Original currency before conversion
    conversion_rate DECIMAL(10,6), -- Exchange rate used for conversion
    balance_after DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(100) UNIQUE NOT NULL,
    related_account_id INTEGER REFERENCES accounts(id),
    status VARCHAR(20) DEFAULT 'COMPLETED', -- COMPLETED, PENDING, FAILED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_cnic ON customers(cnic);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_customer_id ON customer_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_account_id ON customer_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- 6. Create webhooks table for persistent storage
CREATE TABLE IF NOT EXISTS webhooks (
    id VARCHAR(255) PRIMARY KEY, -- Rafiki webhook ID
    webhook_type VARCHAR(100) NOT NULL, -- incoming_payment.created, etc.
    status VARCHAR(20) DEFAULT 'received', -- received, processed, error
    data JSONB NOT NULL, -- Full webhook payload
    wallet_address_id VARCHAR(255),
    account_id INTEGER REFERENCES accounts(id),
    payment_amount DECIMAL(15,2),
    payment_currency VARCHAR(3),
    payment_id VARCHAR(255),
    forwarded_by VARCHAR(50),
    forwarded_at TIMESTAMP,
    original_source VARCHAR(50),
    processed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for webhooks table
CREATE INDEX IF NOT EXISTS idx_webhooks_type ON webhooks(webhook_type);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_wallet_address_id ON webhooks(wallet_address_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_account_id ON webhooks(account_id);

-- 7. Create pending_payments table for AML/CFT screening
CREATE TABLE IF NOT EXISTS pending_payments (
    id SERIAL PRIMARY KEY,
    webhook_id VARCHAR(255) REFERENCES webhooks(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_reference VARCHAR(255) NOT NULL,
    payment_source TEXT, -- Description of payment source
    sender_info JSONB, -- Information about sender
    risk_score INTEGER DEFAULT 0, -- Risk assessment score (0-100)
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    screening_notes TEXT, -- AML officer notes
    screened_by VARCHAR(255), -- Admin who screened
    screened_at TIMESTAMP,
    auto_approval_eligible BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add currency conversion columns (using ALTER to ensure they exist)
ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2);
ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3);
ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(10,6);

-- Create indexes for pending_payments table
CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_pending_payments_account_id ON pending_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_risk_score ON pending_payments(risk_score);
CREATE INDEX IF NOT EXISTS idx_pending_payments_created_at ON pending_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at);
CREATE INDEX IF NOT EXISTS idx_webhooks_payment_id ON webhooks(payment_id);
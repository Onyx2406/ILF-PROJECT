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
    balance DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active',
    
    -- Wallet/ILP fields (nullable - only populated after wallet creation)
    wallet_address_id VARCHAR(255) NULL,
    wallet_address_url VARCHAR(500) NULL,
    wallet_public_name VARCHAR(255) NULL,
    asset_id VARCHAR(255) NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_accounts_iban ON accounts(iban);
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
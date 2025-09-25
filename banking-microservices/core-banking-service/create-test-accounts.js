const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Database configuration
const dbConfig = {
  host: 'localhost',
  port: 5434,
  database: 'abl_cbs',
  user: 'postgres',
  password: 'postgres'
};

const pool = new Pool(dbConfig);

// Username generation function (same as in auth.ts)
function generateUsername(email, iban) {
  const emailPart = email.split('@')[0].toLowerCase();
  const ibanPart = iban.slice(-4);
  const randomPart = Math.floor(10 + Math.random() * 90).toString();
  const username = `${emailPart}${ibanPart}${randomPart}`.substring(0, 20);
  return username;
}

// IBAN generation function
function generateIBAN() {
  const countryCode = 'PK';
  const bankCode = 'ABBL';
  const accountNumber = Math.floor(Math.random() * 1000000000000000).toString().padStart(16, '0');
  return `${countryCode}${bankCode}${accountNumber}`;
}

// Default password
const DEFAULT_PASSWORD = 'Abcd@1234';

async function createTestAccounts() {
  try {
    console.log('🏦 Creating test customers and accounts...\n');
    
    // Hash the default password
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    
    // Test customers and accounts
    const testData = [
      {
        customer: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone_number: '+92-300-1234567',
          address: '123 Main Street, Karachi, Pakistan',
          cnic: '12345-1234567-1',
          dob: '1990-01-15'
        },
        account: {
          currency: 'PKR',
          account_type: 'savings'
        }
      },
      {
        customer: {
          name: 'Sohaib Sarosh Shamsi',
          email: 'sohaib.sarosh.shamsi@example.com',
          phone_number: '+92-300-2345678',
          address: '456 Oak Avenue, Lahore, Pakistan',
          cnic: '23456-2345678-2',
          dob: '1985-05-20'
        },
        account: {
          currency: 'PKR',
          account_type: 'savings'
        }
      },
      {
        customer: {
          name: 'Zohair Ahmed',
          email: 'zohair@example.com',
          phone_number: '+92-300-3456789',
          address: '789 Pine Road, Islamabad, Pakistan',
          cnic: '34567-3456789-3',
          dob: '1992-08-10'
        },
        account: {
          currency: 'PKR',
          account_type: 'savings'
        }
      }
    ];
    
    for (const data of testData) {
      console.log(`Creating customer: ${data.customer.name}`);
      
      // Create customer
      const customerResult = await pool.query(`
        INSERT INTO customers (name, email, phone_number, address, cnic, dob)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING c_id
      `, [
        data.customer.name,
        data.customer.email,
        data.customer.phone_number,
        data.customer.address,
        data.customer.cnic,
        data.customer.dob
      ]);
      
      const customerId = customerResult.rows[0].c_id;
      
      // Generate IBAN and username
      const iban = generateIBAN();
      const username = generateUsername(data.customer.email, iban);
      
      // Create account
      const accountResult = await pool.query(`
        INSERT INTO accounts (
          name, email, iban, currency, balance, available_balance, book_balance,
          account_type, customer_id, username, password_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        data.customer.name,
        data.customer.email,
        iban,
        data.account.currency,
        '0.00',
        '0.00',
        '0.00',
        data.account.account_type,
        customerId,
        username,
        passwordHash
      ]);
      
      const accountId = accountResult.rows[0].id;
      
      // Link customer to account
      await pool.query(`
        INSERT INTO customer_accounts (customer_id, account_id, relationship_type)
        VALUES ($1, $2, $3)
      `, [customerId, accountId, 'PRIMARY']);
      
      console.log(`✅ Created account for ${data.customer.name}`);
      console.log(`   Email: ${data.customer.email}`);
      console.log(`   IBAN: ${iban}`);
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${DEFAULT_PASSWORD}`);
      console.log('');
    }
    
    console.log('🎉 All test accounts created successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   URL: http://localhost:3100');
    console.log(`   Default Password: ${DEFAULT_PASSWORD}`);
    
  } catch (error) {
    console.error('❌ Error creating test accounts:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
createTestAccounts();

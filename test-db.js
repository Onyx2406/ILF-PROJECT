const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5434,
  database: 'abl_cbs',
  user: 'postgres',
  password: 'password123',
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    const customerQuery = `
      SELECT c_id, name, email, phone_number, address, status 
      FROM customers 
      WHERE email = $1
    `;
    
    const customerResult = await pool.query(customerQuery, ['sohaib1083@gmail.com']);
    
    if (customerResult.rows.length === 0) {
      console.log('❌ Customer not found');
      return;
    }

    const customer = customerResult.rows[0];
    console.log('👤 Customer found:', customer.name, 'ID:', customer.c_id);

    const accountsQuery = `
      SELECT id, name, email, iban, account_type, balance, status
      FROM accounts 
      WHERE email = $1
    `;
    
    const accountsResult = await pool.query(accountsQuery, ['sohaib1083@gmail.com']);
    const accounts = accountsResult.rows;
    
    console.log('💰 Found', accounts.length, 'accounts:');
    accounts.forEach(acc => {
      console.log(`  - Account ${acc.iban} (${acc.account_type}): $${acc.balance}`);
    });

    await pool.end();
    console.log('✅ Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }
}

testConnection();

const { Pool } = require('pg');

// Database configuration
const dbConfig = {
  host: 'localhost',
  port: 5434,
  database: 'abl_cbs',
  user: 'postgres',
  password: 'postgres'
};

const pool = new Pool(dbConfig);

async function showCredentials() {
  try {
    console.log('🔍 Fetching all account credentials...\n');
    
    // Get all accounts with usernames
    const result = await pool.query(`
      SELECT id, name, email, iban, username 
      FROM accounts 
      WHERE username IS NOT NULL AND username != ''
      ORDER BY id
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No accounts with credentials found!');
      return;
    }
    
    console.log(`Found ${result.rows.length} accounts with credentials:\n`);
    
    result.rows.forEach((account, index) => {
      console.log(`${index + 1}. ${account.name}`);
      console.log(`   Email: ${account.email}`);
      console.log(`   IBAN: ${account.iban}`);
      console.log(`   Username: ${account.username}`);
      console.log(`   Password: Abcd@1234`);
      console.log('');
    });
    
    console.log('🌐 Login URL: http://localhost:3100');
    console.log('🔑 Default Password for all accounts: Abcd@1234');
    
  } catch (error) {
    console.error('❌ Error fetching credentials:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
showCredentials();

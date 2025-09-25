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

async function checkDatabase() {
  try {
    console.log('🔍 Checking database contents...\n');
    
    // Get all accounts
    const result = await pool.query(`
      SELECT id, name, email, iban, username, password_hash 
      FROM accounts 
      ORDER BY id
    `);
    
    console.log(`Found ${result.rows.length} accounts in database:\n`);
    
    result.rows.forEach((account, index) => {
      console.log(`${index + 1}. ${account.name}`);
      console.log(`   Email: ${account.email}`);
      console.log(`   IBAN: ${account.iban}`);
      console.log(`   Username: ${account.username || 'NULL'}`);
      console.log(`   Password Hash: ${account.password_hash ? 'EXISTS' : 'NULL'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
checkDatabase();

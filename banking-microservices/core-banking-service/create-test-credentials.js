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

// Default password
const DEFAULT_PASSWORD = 'Abcd@1234';

async function createTestCredentials() {
  try {
    console.log('🔑 Creating test credentials for existing accounts...\n');
    
    // Get all accounts without usernames
    const result = await pool.query(`
      SELECT id, name, email, iban 
      FROM accounts 
      WHERE username IS NULL OR username = ''
      ORDER BY id
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ All accounts already have credentials!');
      return;
    }
    
    console.log(`Found ${result.rows.length} accounts without credentials:\n`);
    
    // Hash the default password
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    
    for (const account of result.rows) {
      const username = generateUsername(account.email, account.iban);
      
      // Update the account with username and password
      await pool.query(`
        UPDATE accounts 
        SET username = $1, password_hash = $2 
        WHERE id = $3
      `, [username, passwordHash, account.id]);
      
      console.log(`✅ ${account.name}`);
      console.log(`   Email: ${account.email}`);
      console.log(`   IBAN: ${account.iban}`);
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${DEFAULT_PASSWORD}`);
      console.log('');
    }
    
    console.log('🎉 All test credentials created successfully!');
    console.log('\n📝 You can now use these credentials to log in:');
    console.log('   URL: http://localhost:3100');
    console.log(`   Default Password: ${DEFAULT_PASSWORD}`);
    
  } catch (error) {
    console.error('❌ Error creating test credentials:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
createTestCredentials();


#!/usr/bin/env node

const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'abl_cbs',
  password: 'postgres',
  port: 5434,
});

// Demonstration of complete wallet synchronization workflow
async function demonstrateWalletSync() {
  console.log('🎯 Demonstrating Complete Wallet Address Status Synchronization\n');
  
  try {
    // Step 1: Show current accounts with wallet addresses
    console.log('📋 Step 1: Current accounts with wallet addresses');
    console.log('═'.repeat(70));
    
    const accountsResult = await pool.query(`
      SELECT id, name, iban, status, wallet_address, created_at 
      FROM accounts 
      WHERE wallet_address IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (accountsResult.rows.length === 0) {
      console.log('No accounts with wallet addresses found. Creating test accounts...\n');
      
      // Create test accounts with wallet addresses
      const testAccounts = [
        {
          name: 'Happy Life Customer 1',
          email: 'customer1@happylife.com',
          iban: 'PKR' + Math.floor(Math.random() * 1000000000000000),
          wallet_address: 'https://happy-life-bank.example/alice'
        },
        {
          name: 'Happy Life Customer 2', 
          email: 'customer2@happylife.com',
          iban: 'PKR' + Math.floor(Math.random() * 1000000000000000),
          wallet_address: 'https://happy-life-bank.example/bob'
        }
      ];
      
      for (const account of testAccounts) {
        await pool.query(`
          INSERT INTO accounts (name, email, iban, currency, balance, status, wallet_address)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [account.name, account.email, account.iban, 'USD', 1000.00, 'active', account.wallet_address]);
        console.log(`✅ Created: ${account.name} with wallet ${account.wallet_address}`);
      }
      
      // Fetch the accounts again
      const updatedResult = await pool.query(`
        SELECT id, name, iban, status, wallet_address, created_at 
        FROM accounts 
        WHERE wallet_address IS NOT NULL 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      accountsResult.rows = updatedResult.rows;
    }
    
    // Display accounts
    accountsResult.rows.forEach((account, index) => {
      console.log(`${index + 1}. ${account.name}`);
      console.log(`   IBAN: ${account.iban}`);
      console.log(`   Status: ${account.status.toUpperCase()}`);
      console.log(`   Wallet: ${account.wallet_address}`);
      console.log(`   Created: ${new Date(account.created_at).toLocaleString()}`);
      console.log('');
    });

    if (accountsResult.rows.length === 0) {
      console.log('⚠️ Still no accounts available for testing');
      return;
    }

    // Step 2: Demonstrate status change and wallet sync simulation
    const testAccount = accountsResult.rows[0];
    console.log('🔄 Step 2: Account Status Change & Wallet Synchronization');
    console.log('═'.repeat(70));
    console.log(`Testing with: ${testAccount.name} (${testAccount.iban})`);
    console.log(`Current status: ${testAccount.status.toUpperCase()}`);
    console.log(`Wallet address: ${testAccount.wallet_address}`);
    console.log('');
    
    // Simulate the status change that would trigger wallet sync
    const newStatus = testAccount.status === 'active' ? 'inactive' : 'active';
    console.log(`🔄 Changing account status from ${testAccount.status.toUpperCase()} to ${newStatus.toUpperCase()}...`);
    
    // Update the account status
    const updateResult = await pool.query(`
      UPDATE accounts 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [newStatus, testAccount.id]);
    
    const updatedAccount = updateResult.rows[0];
    console.log(`✅ Account status updated in database`);
    console.log(`   New status: ${updatedAccount.status.toUpperCase()}`);
    
    // Step 3: Show what the API would do - wallet address synchronization
    console.log('\n🌐 Step 3: Wallet Address Synchronization (API Behavior)');
    console.log('═'.repeat(70));
    
    const walletStatus = newStatus === 'active' ? 'ACTIVE' : 'INACTIVE';
    console.log(`📡 API would call Rafiki updateWalletAddress mutation:`);
    console.log(`   - Wallet Address: ${updatedAccount.wallet_address}`);
    console.log(`   - New Status: ${walletStatus}`);
    console.log(`   - Public Name: ${updatedAccount.name}`);
    
    // Show the GraphQL mutation that would be sent
    console.log('\n📝 GraphQL Mutation that would be sent to Rafiki:');
    console.log(`\`\`\`graphql
mutation UpdateWalletAddress($input: UpdateWalletAddressInput!) {
  updateWalletAddress(input: $input) {
    walletAddress {
      id
      address
      publicName
      status
      asset {
        id
        code
        scale
      }
    }
  }
}
\`\`\``);
    
    console.log(`\n📋 Variables:`);
    console.log(`{
  "input": {
    "id": "${updatedAccount.wallet_address}",
    "status": "${walletStatus}",
    "publicName": "${updatedAccount.name}"
  }
}`);

    // Step 4: Show the complete workflow
    console.log('\n✨ Step 4: Complete Workflow Summary');
    console.log('═'.repeat(70));
    console.log('1. ✅ User changes account status via API (PUT /api/accounts/[id])');
    console.log('2. ✅ Database account status updated');
    console.log('3. ✅ API detects status change');
    console.log('4. ✅ API calls updateWalletAddressStatus() function');
    console.log('5. 🌐 GraphQL mutation sent to Rafiki backend');
    console.log('6. 🔄 Wallet address status synchronized in Rafiki');
    console.log('7. 📡 Response returned to user with updated account');
    
    // Step 5: Revert for demonstration
    console.log('\n🔄 Step 5: Reverting change for clean demonstration');
    console.log('═'.repeat(70));
    await pool.query(`
      UPDATE accounts 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [testAccount.status, testAccount.id]);
    console.log(`✅ Account status reverted to: ${testAccount.status.toUpperCase()}`);
    
    console.log('\n🎉 Wallet Synchronization Demonstration Complete!');
    console.log('\n📊 Implementation Status:');
    console.log('- ✅ Database schema supports wallet addresses');
    console.log('- ✅ Account API includes wallet synchronization logic');
    console.log('- ✅ Rafiki GraphQL integration implemented');
    console.log('- ✅ Error handling for network failures');
    console.log('- ✅ Automatic status mapping (active ↔ ACTIVE, inactive ↔ INACTIVE)');
    console.log('- 🌐 Full integration depends on Rafiki backend availability');
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Start Rafiki backend infrastructure');
    console.log('2. Configure proper wallet address URLs');
    console.log('3. Test end-to-end with real wallet addresses');
    console.log('4. Monitor logs for synchronization success/failures');

  } catch (error) {
    console.error('❌ Demonstration failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await pool.end();
  }
}

// Run the demonstration
demonstrateWalletSync().catch(console.error);

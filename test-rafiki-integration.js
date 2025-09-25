#!/usr/bin/env node

const axios = require('axios');

async function testRafikiIntegration() {
  try {
    console.log('🧪 Testing Rafiki Integration...\n');

    // Step 1: Create a customer
    console.log('📋 Step 1: Creating a customer...');
    const customerResponse = await axios.post('http://localhost:8101/api/customers', {
      first_name: 'Test',
      last_name: 'Customer',
      email: 'test.customer@example.com',
      phone_number: '+1234567890',
      date_of_birth: '1990-01-01',
      cnic_number: '1234567890123',
      address: '123 Test Street, Test City'
    });

    const customerId = customerResponse.data.data.id;
    console.log(`✅ Customer created with ID: ${customerId}`);

    // Step 2: Create an account
    console.log('\n📋 Step 2: Creating an account...');
    const accountResponse = await axios.post('http://localhost:8101/api/accounts', {
      customer_id: customerId,
      account_type: 'savings',
      initial_deposit: 1000.00,
      branch_code: 'BR001'
    });

    const accountId = accountResponse.data.data.id;
    const accountNumber = accountResponse.data.data.account_number;
    console.log(`✅ Account created with ID: ${accountId}, Number: ${accountNumber}`);

    // Step 3: Create wallet address using Rafiki
    console.log('\n📋 Step 3: Creating wallet address via Rafiki...');
    const walletResponse = await axios.patch(`http://localhost:8101/api/accounts/${accountId}/wallet`, {
      wallet_public_name: 'Test Customer Wallet',
      asset_id: 'USD'
    });

    console.log('\n🎉 Rafiki Integration Test Results:');
    console.log('=====================================');
    console.log('✅ Customer created:', customerId);
    console.log('✅ Account created:', accountId);
    console.log('✅ Wallet created in Rafiki:');
    console.log('   - Rafiki ID:', walletResponse.data.data.rafiki_wallet.id);
    console.log('   - Address:', walletResponse.data.data.rafiki_wallet.address);
    console.log('   - Public Name:', walletResponse.data.data.rafiki_wallet.publicName);
    console.log('   - Status:', walletResponse.data.data.rafiki_wallet.status);
    console.log('   - Asset:', walletResponse.data.data.rafiki_wallet.asset?.code || 'N/A');
    console.log('\n🌟 All tests passed! Rafiki integration is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testRafikiIntegration();

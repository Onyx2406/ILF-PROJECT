#!/usr/bin/env node

/**
 * Test complete reversal flow with real Cloud Nine wallet address
 */

const axios = require('axios');
const { ensureDatabaseInitialized, getDatabase } = require('./lib/database.ts');

async function testReversalWithRealCloudNineWallet() {
  console.log('🧪 Testing Reversal with Real Cloud Nine Wallet');
  console.log('================================================');
  
  try {
    await ensureDatabaseInitialized();
    const pool = getDatabase();
    
    // Step 1: Create a test pending payment with a real Cloud Nine sender
    console.log('📝 Creating test pending payment with real Cloud Nine sender...');
    
    const realSenderWalletId = '42b82566-a416-459f-b000-0e3118d472f8'; // gfranklin
    const realSenderWalletAddress = 'https://cloud-nine-wallet-backend/accounts/gfranklin';
    
    // Get a real account to receive the payment
    const accountResult = await pool.query(
      'SELECT id FROM accounts WHERE wallet_id IS NOT NULL LIMIT 1'
    );
    
    if (accountResult.rows.length === 0) {
      throw new Error('No accounts found for testing');
    }
    
    const receiverAccountId = accountResult.rows[0].id;
    
    // Create a test webhook with proper sender info
    const webhookData = {
      id: 'test-' + Date.now(),
      type: 'incoming_payment.completed',
      data: {
        walletAddressId: realSenderWalletId,
        incomingAmount: {
          value: '500', // $5.00 in cents
          assetCode: 'USD',
          assetScale: 2
        }
      },
      metadata: {
        senderWalletAddress: realSenderWalletAddress,
        description: 'Test payment for reversal testing'
      }
    };
    
    const webhookResult = await pool.query(`
      INSERT INTO webhooks (data, processed_at, created_at)
      VALUES ($1, NOW(), NOW())
      RETURNING id
    `, [JSON.stringify(webhookData)]);
    
    const webhookId = webhookResult.rows[0].id;
    
    // Create sender_info with the real wallet information
    const senderInfo = {
      walletAddressId: realSenderWalletId,
      client: 'https://cloud-nine-wallet-backend/.well-known/pay',
      metadata: {
        senderWalletAddress: realSenderWalletAddress,
        description: 'Real Cloud Nine test payment'
      }
    };
    
    // Create a pending payment
    const pendingPaymentResult = await pool.query(`
      INSERT INTO pending_payments (
        account_id, amount, currency, original_amount, original_currency,
        status, webhook_id, sender, sender_info, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id
    `, [
      receiverAccountId,
      '1392.50', // Converted PKR amount
      'PKR',
      '5.00',    // Original USD amount
      'USD',
      'PENDING',
      webhookId,
      realSenderWalletAddress,
      JSON.stringify(senderInfo)
    ]);
    
    const testPaymentId = pendingPaymentResult.rows[0].id;
    console.log('✅ Created test pending payment ID:', testPaymentId);
    console.log('📤 Sender wallet address:', realSenderWalletAddress);
    console.log('🏦 Sender wallet ID:', realSenderWalletId);
    
    // Step 2: Test the rejection with reversal
    console.log('\n🌐 Testing payment rejection with real Cloud Nine reversal...');
    
    const rejectionResponse = await axios.post('http://localhost:3200/api/aml/pending-payments', {
      paymentId: testPaymentId,
      action: 'REJECT',
      reason: 'Test reversal with real Cloud Nine wallet'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📤 API Response Status:', rejectionResponse.status);
    console.log('📝 Response data:', JSON.stringify(rejectionResponse.data, null, 2));
    
    // Step 3: Analyze the results
    const isSuccess = rejectionResponse.data.success === true;
    const hasReversal = rejectionResponse.data.data?.reversal;
    const reversalStatus = hasReversal?.status;
    
    console.log('\n🎯 Test Results:');
    console.log('================');
    console.log(`API Success: ${isSuccess ? '✅' : '❌'}`);
    console.log(`Reversal Attempted: ${hasReversal ? '✅' : '❌'}`);
    console.log(`Reversal Status: ${reversalStatus || 'N/A'}`);
    
    if (reversalStatus === 'COMPLETED') {
      console.log('\n🎉 SUCCESS: Real Cloud Nine reversal payment completed!');
      console.log('🏦 Reversal Payment ID:', hasReversal.paymentId);
      console.log('💰 Reversal Amount:', hasReversal.amount, hasReversal.currency);
      console.log('📤 Reversal Recipient:', hasReversal.recipient);
    } else if (reversalStatus === 'FAILED') {
      console.log('\n❌ FAILED: Reversal payment failed');
      console.log('🔍 Error:', hasReversal.error);
    } else {
      console.log('\n⚠️  PARTIAL: Credit/debit completed but no reversal status');
    }
    
    // Step 4: Check final payment status
    const finalPaymentResult = await pool.query(
      'SELECT status FROM pending_payments WHERE id = $1',
      [testPaymentId]
    );
    
    const finalStatus = finalPaymentResult.rows[0].status;
    console.log('\n📊 Final Payment Status:', finalStatus);
    
    console.log('\n🔚 Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testReversalWithRealCloudNineWallet();

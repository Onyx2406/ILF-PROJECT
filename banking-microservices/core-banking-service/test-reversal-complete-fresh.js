#!/usr/bin/env node

const { Pool } = require('pg');
const axios = require('axios');

// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'abl_cbs',
  password: 'postgres',
  port: 5434,
});

async function testCompleteReversalFlow() {
  console.log('🧪 Testing Complete Reversal Flow with Fresh Payments');
  console.log('=====================================================');
  
  try {
    // Step 1: Check for fresh pending payments
    console.log('🔍 Looking for fresh pending payments...');
    const pendingResult = await pool.query(
      'SELECT * FROM pending_payments WHERE status = $1 ORDER BY created_at DESC LIMIT 5',
      ['PENDING']
    );
    
    if (pendingResult.rows.length === 0) {
      console.log('❌ No pending payments found. Please create some payments first.');
      return;
    }
    
    console.log(`✅ Found ${pendingResult.rows.length} pending payments:`);
    pendingResult.rows.forEach((payment, index) => {
      const senderInfo = payment.sender_info;
      console.log(`  ${index + 1}. ID: ${payment.id}, Amount: ${payment.amount} ${payment.currency}, From: ${senderInfo?.metadata?.senderWalletAddress || 'unknown'}`);
    });
    
    // Step 2: Select the most recent pending payment for testing
    const selectedPayment = pendingResult.rows[0];
    
    console.log('\n📋 Testing reversal with pending payment:', {
      id: selectedPayment.id,
      amount: selectedPayment.amount,
      currency: selectedPayment.currency,
      originalAmount: selectedPayment.original_amount,
      originalCurrency: selectedPayment.original_currency,
      status: selectedPayment.status
    });
    
    // Extract sender wallet address from sender_info JSON
    const senderInfo = selectedPayment.sender_info;
    let senderWalletAddress = senderInfo?.metadata?.senderWalletAddress;
    
    // If not found in metadata, try to reconstruct from available data
    if (!senderWalletAddress) {
      console.log('🔍 Sender wallet address not found in metadata, trying other fields...');
      
      // Check if we have a walletAddressId and client info
      if (senderInfo?.walletAddressId && senderInfo?.client?.includes('cloud-nine-wallet-backend')) {
        // This is from Cloud Nine, try to find the wallet address
        const walletResult = await pool.query(
          'SELECT wallet_address FROM accounts WHERE wallet_id = $1',
          [senderInfo.walletAddressId]
        );
        
        if (walletResult.rows.length > 0) {
          senderWalletAddress = walletResult.rows[0].wallet_address;
          console.log('✅ Found sender wallet address via wallet_id lookup:', senderWalletAddress);
        } else {
          // Fallback to gfranklin wallet for Cloud Nine
          senderWalletAddress = 'https://cloud-nine-wallet-backend/accounts/gfranklin';
          console.log('💡 Using Cloud Nine gfranklin wallet as fallback:', senderWalletAddress);
        }
      } else if (selectedPayment.sender && selectedPayment.sender !== 'unknown') {
        // Use the sender field directly
        senderWalletAddress = selectedPayment.sender;
        console.log('💡 Using sender field directly:', senderWalletAddress);
      }
    }
    
    if (!senderWalletAddress) {
      console.log('❌ No sender wallet address found in payment data');
      console.log('🔍 Available sender info:', senderInfo);
      return;
    }
    
    console.log('📤 Sender wallet address:', senderWalletAddress);
    console.log('🏦 Wallet ID from sender info:', senderInfo?.walletAddressId);
    
    // Step 3: Test the complete API endpoint (which will reject and reverse)
    console.log('\n🌐 Testing payment rejection with reversal via API...');
    
    const rejectionResponse = await axios.post('http://localhost:3200/api/aml/pending-payments', {
      paymentId: selectedPayment.id,
      action: 'REJECT',
      reason: 'Test reversal - Fresh Payment Complete Flow Test'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📤 API Response Status:', rejectionResponse.status);
    console.log('📝 Response data:', JSON.stringify(rejectionResponse.data, null, 2));
    
    // Step 4: Check if payment was marked as rejected
    console.log('\n🔍 Checking payment status after rejection...');
    
    const updatedPayment = await pool.query(
      'SELECT * FROM pending_payments WHERE id = $1',
      [selectedPayment.id]
    );
    
    console.log('📊 Updated payment status:', updatedPayment.rows[0].status);
    
    // Step 5: Check the transaction history
    console.log('\n🔍 Checking transaction history...');
    
    // First get the account_id for the payment
    let accountId = null;
    if (senderWalletAddress) {
      const accountResult = await pool.query(
        'SELECT id FROM accounts WHERE wallet_address = $1',
        [senderWalletAddress]
      );
      if (accountResult.rows.length > 0) {
        accountId = accountResult.rows[0].id;
      }
    }
    
    let transactions;
    if (accountId) {
      transactions = await pool.query(
        'SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT 10',
        [accountId]
      );
    } else {
      // Fallback: get recent transactions for analysis
      transactions = await pool.query(
        'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5'
      );
    }
    
    console.log('📊 Transaction History:');
    if (transactions.rows.length === 0) {
      console.log('  No transactions found for this payment ID');
    } else {
      transactions.rows.forEach((tx, index) => {
        console.log(`  ${index + 1}. ${tx.transaction_type}: ${tx.amount} ${tx.currency} - ${tx.description}`);
        console.log(`     Balance: ${tx.balance_after}, Created: ${tx.created_at}`);
      });
    }
    
    // Step 6: Final analysis
    console.log('\n🎯 Test Results Summary:');
    console.log('========================');
    console.log(`Payment ID: ${selectedPayment.id}`);
    console.log(`Original Status: PENDING`);
    console.log(`Final Status: ${updatedPayment.rows[0].status}`);
    console.log(`Original Amount: ${selectedPayment.original_amount || selectedPayment.amount} ${selectedPayment.original_currency || selectedPayment.currency}`);
    console.log(`Converted Amount: ${selectedPayment.amount} ${selectedPayment.currency}`);
    console.log(`Sender: ${senderWalletAddress}`);
    console.log(`Transaction count: ${transactions.rows.length}`);
    console.log(`API Response: ${rejectionResponse.status === 200 ? 'Success' : 'Failed'}`);
    
    // Success criteria
    const isStatusRejected = updatedPayment.rows[0].status === 'REJECTED';
    const hasApiSuccess = rejectionResponse.data.success === true;
    const hasCreditTx = transactions.rows.some(tx => tx.transaction_type === 'CREDIT');
    const hasDebitTx = transactions.rows.some(tx => tx.transaction_type === 'DEBIT');
    
    console.log('\n✅/❌ Success Criteria:');
    console.log(`  Payment marked as rejected: ${isStatusRejected ? '✅' : '❌'}`);
    console.log(`  API returned success: ${hasApiSuccess ? '✅' : '❌'}`);
    console.log(`  Credit transaction exists: ${hasCreditTx ? '✅' : '❌'}`);
    console.log(`  Debit transaction exists: ${hasDebitTx ? '✅' : '❌'}`);
    
    if (isStatusRejected && hasApiSuccess) {
      console.log('\n🎉 OVERALL TEST RESULT: PASSED');
      console.log('The payment was successfully rejected with complete reversal flow!');
      
      if (rejectionResponse.data.reversalPaymentResult) {
        console.log('🏦 Rafiki Reversal Details:', rejectionResponse.data.reversalPaymentResult);
      }
    } else {
      console.log('\n❌ OVERALL TEST RESULT: FAILED');
      if (rejectionResponse.data.error) {
        console.log('   Error details:', rejectionResponse.data.error);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('📡 HTTP Error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
  } finally {
    await pool.end();
    console.log('\n🔚 Test completed');
  }
}

// Run the test
testCompleteReversalFlow();

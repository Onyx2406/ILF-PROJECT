// Create a new payment and test the approval process
const testCreateAndApprovePayment = async () => {
  console.log('🧪 Creating Payment and Testing Approval Process\n');

  try {
    // Step 1: Create a new USD to PKR payment
    const pkrWalletId = '6f1b9b81-f5a0-42b0-9886-8a7882d93ff5';
    
    console.log('📝 Step 1: Creating new USD to PKR payment...');
    const conversionWebhook = {
      id: 'test-approval-process-001',
      type: 'incoming_payment.completed',
      data: {
        id: 'payment-approval-process-001',
        walletAddressId: pkrWalletId,
        client: 'Approval Process Test',
        incomingAmount: {
          value: '2500', // USD 25.00
          assetCode: 'USD',
          assetScale: 2
        },
        receivedAmount: {
          value: '2500',
          assetCode: 'USD', 
          assetScale: 2
        },
        metadata: {
          description: 'Testing approval process - should update existing transaction'
        }
      }
    };

    const webhookResponse = await fetch('http://localhost:3200/api/webhooks/rafiki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversionWebhook)
    });

    const webhookResult = await webhookResponse.json();
    console.log('✅ Payment created:', JSON.stringify(webhookResult, null, 2));

    // Wait for processing
    console.log('\n⏳ Waiting 3 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Get the pending payment
    console.log('\n📝 Step 2: Getting the pending payment...');
    const amlResponse = await fetch('http://localhost:3200/api/aml/pending-payments');
    const amlData = await amlResponse.json();
    
    const pendingPayment = amlData.data.pendingPayments.find(p => 
      p.senderInfo?.client === 'Approval Process Test'
    );
    
    if (!pendingPayment) {
      console.log('❌ Pending payment not found');
      return;
    }
    
    console.log(`✅ Found pending payment: ID ${pendingPayment.id}, Amount: ${pendingPayment.currency} ${pendingPayment.amount}`);
    
    // Step 3: Get the related PENDING transaction
    console.log('\n📝 Step 3: Finding related PENDING transaction...');
    const transactionsResponse = await fetch('http://localhost:3200/api/transactions?limit=10');
    const transactionsData = await transactionsResponse.json();
    
    const pendingTransaction = transactionsData.data.transactions.find(t => 
      t.status === 'PENDING' && t.account_id === pendingPayment.accountId &&
      t.description.includes('payment-approval-process-001')
    );
    
    if (!pendingTransaction) {
      console.log('❌ Related PENDING transaction not found');
      return;
    }
    
    console.log(`✅ Found PENDING transaction: ID ${pendingTransaction.id}, Status: ${pendingTransaction.status}`);
    console.log(`📋 Transaction details: ${pendingTransaction.currency} ${pendingTransaction.amount}, Type: ${pendingTransaction.transaction_type}`);
    
    // Step 4: Count total transactions before approval
    const totalTransactionsBefore = transactionsData.data.transactions.length;
    console.log(`\n📊 Total transactions before approval: ${totalTransactionsBefore}`);
    
    // Step 5: Approve the pending payment
    console.log('\n📝 Step 4: Approving the pending payment...');
    const approvalResponse = await fetch('http://localhost:3200/api/aml/pending-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: pendingPayment.id,
        action: 'APPROVE',
        screeningNotes: 'Test approval - verifying transaction update behavior',
        screenedBy: 'Test System'
      })
    });
    
    const approvalResult = await approvalResponse.json();
    console.log('✅ Approval Response:', JSON.stringify(approvalResult, null, 2));
    
    // Step 6: Check the transaction after approval
    console.log('\n📝 Step 5: Checking transaction after approval...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing
    
    const transactionsAfterResponse = await fetch('http://localhost:3200/api/transactions?limit=10');
    const transactionsAfterData = await transactionsAfterResponse.json();
    
    const updatedTransaction = transactionsAfterData.data.transactions.find(t => t.id === pendingTransaction.id);
    const totalTransactionsAfter = transactionsAfterData.data.transactions.length;
    
    console.log(`📊 Total transactions after approval: ${totalTransactionsAfter}`);
    
    if (updatedTransaction) {
      console.log(`\n🔍 Transaction Update Results:`);
      console.log(`  • Transaction ID: ${updatedTransaction.id} (same as before)`);
      console.log(`  • Status: ${pendingTransaction.status} → ${updatedTransaction.status}`);
      console.log(`  • Type: ${pendingTransaction.transaction_type} → ${updatedTransaction.transaction_type}`);
      console.log(`  • Amount: ${updatedTransaction.currency} ${updatedTransaction.amount} (unchanged)`);
      console.log(`  • Description changed: ${pendingTransaction.description !== updatedTransaction.description ? '✅ YES' : '❌ NO'}`);
      
      // Check if transaction count is the same (no new transaction created)
      if (totalTransactionsBefore === totalTransactionsAfter) {
        console.log('\n🎉 SUCCESS! Transaction was updated in place (no new transaction created)');
        
        if (updatedTransaction.status === 'COMPLETED') {
          console.log('✅ Transaction status correctly updated to COMPLETED');
        } else {
          console.log(`⚠️ Transaction status is ${updatedTransaction.status}, expected COMPLETED`);
        }
        
      } else {
        console.log('\n❌ ISSUE: Transaction count changed - new transaction may have been created');
        console.log(`   Before: ${totalTransactionsBefore}, After: ${totalTransactionsAfter}`);
      }
    } else {
      console.log('\n❌ ISSUE: Original transaction not found after approval');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testCreateAndApprovePayment();

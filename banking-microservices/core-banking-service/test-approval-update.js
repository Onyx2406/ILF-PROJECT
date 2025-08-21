// Test the updated approval process that updates existing transaction instead of creating new one
const testUpdatedApprovalProcess = async () => {
  console.log('🧪 Testing Updated Approval Process\n');

  try {
    // Step 1: Check current pending payments
    console.log('📝 Step 1: Checking current pending payments...');
    const amlResponse = await fetch('http://localhost:3200/api/aml/pending-payments');
    const amlData = await amlResponse.json();
    
    if (amlData.data.pendingPayments.length === 0) {
      console.log('❌ No pending payments found to test');
      return;
    }
    
    const pendingPayment = amlData.data.pendingPayments[0];
    console.log(`✅ Found pending payment: ID ${pendingPayment.id}, Amount: ${pendingPayment.currency} ${pendingPayment.amount}`);
    
    // Step 2: Check current transactions before approval
    console.log('\n📝 Step 2: Checking transactions before approval...');
    const transactionsBeforeResponse = await fetch('http://localhost:3200/api/transactions?limit=10');
    const transactionsBeforeData = await transactionsBeforeResponse.json();
    
    const pendingTransactions = transactionsBeforeData.data.transactions.filter(t => t.status === 'PENDING');
    console.log(`📊 Transactions with PENDING status: ${pendingTransactions.length}`);
    
    const relatedTransaction = pendingTransactions.find(t => 
      t.account_id === pendingPayment.accountId
    );
    
    if (relatedTransaction) {
      console.log(`📋 Found related PENDING transaction: ID ${relatedTransaction.id}, Status: ${relatedTransaction.status}, Amount: ${relatedTransaction.currency} ${relatedTransaction.amount}`);
    }
    
    // Step 3: Approve the pending payment
    console.log('\n📝 Step 3: Approving the pending payment...');
    const approvalResponse = await fetch('http://localhost:3200/api/aml/pending-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: pendingPayment.id,
        action: 'APPROVE',
        screeningNotes: 'Test approval - checking transaction update behavior',
        screenedBy: 'Test System'
      })
    });
    
    const approvalResult = await approvalResponse.json();
    console.log('✅ Approval Response:', JSON.stringify(approvalResult, null, 2));
    
    // Step 4: Check transactions after approval
    console.log('\n📝 Step 4: Checking transactions after approval...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing
    
    const transactionsAfterResponse = await fetch('http://localhost:3200/api/transactions?limit=10');
    const transactionsAfterData = await transactionsAfterResponse.json();
    
    const completedTransactions = transactionsAfterData.data.transactions.filter(t => t.status === 'COMPLETED');
    const pendingTransactionsAfter = transactionsAfterData.data.transactions.filter(t => t.status === 'PENDING');
    
    console.log(`📊 After approval:`);
    console.log(`  • COMPLETED transactions: ${completedTransactions.length}`);
    console.log(`  • PENDING transactions: ${pendingTransactionsAfter.length}`);
    
    // Check if the specific transaction was updated
    if (relatedTransaction) {
      const updatedTransaction = transactionsAfterData.data.transactions.find(t => t.id === relatedTransaction.id);
      
      if (updatedTransaction) {
        console.log(`\n🔍 Transaction Update Check:`);
        console.log(`  • Transaction ID: ${updatedTransaction.id}`);
        console.log(`  • Status Before: ${relatedTransaction.status}`);
        console.log(`  • Status After: ${updatedTransaction.status}`);
        console.log(`  • Type Before: ${relatedTransaction.transaction_type}`);
        console.log(`  • Type After: ${updatedTransaction.transaction_type}`);
        console.log(`  • Description Before: ${relatedTransaction.description.substring(0, 50)}...`);
        console.log(`  • Description After: ${updatedTransaction.description.substring(0, 50)}...`);
        
        if (updatedTransaction.status === 'COMPLETED' && relatedTransaction.status === 'PENDING') {
          console.log('\n🎉 SUCCESS! Existing transaction was updated to COMPLETED (no new transaction created)');
        } else {
          console.log('\n⚠️ Transaction status was not updated as expected');
        }
      }
    }
    
    // Step 5: Count total transactions to verify no new ones were created
    const totalTransactionsBefore = transactionsBeforeData.data.transactions.length;
    const totalTransactionsAfter = transactionsAfterData.data.transactions.length;
    
    console.log(`\n📈 Transaction Count Check:`);
    console.log(`  • Before approval: ${totalTransactionsBefore} transactions`);
    console.log(`  • After approval: ${totalTransactionsAfter} transactions`);
    
    if (totalTransactionsBefore === totalTransactionsAfter) {
      console.log('✅ CORRECT: No new transaction was created (existing one was updated)');
    } else {
      console.log('❌ ISSUE: New transaction may have been created');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testUpdatedApprovalProcess();

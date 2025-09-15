// Test approval of the existing pending payment
const testApprovalFixed = async () => {
  console.log('🧪 Testing Fixed Approval Process\n');

  try {
    // Step 1: Get the pending payment
    console.log('📝 Step 1: Getting the pending payment...');
    const amlResponse = await fetch('http://localhost:3200/api/aml/pending-payments');
    const amlData = await amlResponse.json();
    
    const pendingPayment = amlData.data.pendingPayments[0];
    console.log(`✅ Found pending payment: ID ${pendingPayment.id}, Amount: ${pendingPayment.currency} ${pendingPayment.amount}`);
    
    // Step 2: Find the related PENDING transaction
    console.log('\n📝 Step 2: Finding related PENDING transaction...');
    const transactionsResponse = await fetch('http://localhost:3200/api/transactions?limit=10');
    const transactionsData = await transactionsResponse.json();
    
    const pendingTransaction = transactionsData.data.transactions.find(t => 
      t.status === 'PENDING' && t.account_id === pendingPayment.accountId
    );
    
    if (!pendingTransaction) {
      console.log('❌ Related PENDING transaction not found');
      return;
    }
    
    console.log(`✅ Found PENDING transaction: ID ${pendingTransaction.id}`);
    console.log(`📋 Before approval: Status=${pendingTransaction.status}, Type=${pendingTransaction.transaction_type}`);
    console.log(`📋 Description: ${pendingTransaction.description.substring(0, 80)}...`);
    
    const totalTransactionsBefore = transactionsData.data.transactions.length;
    console.log(`📊 Total transactions before: ${totalTransactionsBefore}`);
    
    // Step 3: Approve the pending payment
    console.log('\n📝 Step 3: Approving the pending payment...');
    const approvalResponse = await fetch('http://localhost:3200/api/aml/pending-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: pendingPayment.id,
        action: 'APPROVE',
        screeningNotes: 'Fixed approval test',
        screenedBy: 'Test System'
      })
    });
    
    const approvalResult = await approvalResponse.json();
    console.log('✅ Approval Response:', JSON.stringify(approvalResult, null, 2));
    
    if (!approvalResult.success) {
      console.log('❌ Approval failed, stopping test');
      return;
    }
    
    // Step 4: Check the transaction after approval
    console.log('\n📝 Step 4: Checking transaction after approval...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const transactionsAfterResponse = await fetch('http://localhost:3200/api/transactions?limit=10');
    const transactionsAfterData = await transactionsAfterResponse.json();
    
    const updatedTransaction = transactionsAfterData.data.transactions.find(t => t.id === pendingTransaction.id);
    const totalTransactionsAfter = transactionsAfterData.data.transactions.length;
    
    console.log(`📊 Total transactions after: ${totalTransactionsAfter}`);
    
    if (updatedTransaction) {
      console.log(`\n🔍 Transaction Update Results:`);
      console.log(`  • Transaction ID: ${updatedTransaction.id} (unchanged)`);
      console.log(`  • Status: ${pendingTransaction.status} → ${updatedTransaction.status}`);
      console.log(`  • Type: ${pendingTransaction.transaction_type} → ${updatedTransaction.transaction_type}`);
      console.log(`  • Amount: ${updatedTransaction.currency} ${updatedTransaction.amount} (unchanged)`);
      console.log(`  • Description before: ${pendingTransaction.description.substring(0, 50)}...`);
      console.log(`  • Description after: ${updatedTransaction.description.substring(0, 50)}...`);
      console.log(`  • Description changed: ${pendingTransaction.description !== updatedTransaction.description ? '✅ YES' : '❌ NO'}`);
      
      console.log(`\n📈 Results:`);
      console.log(`  • Transaction count unchanged: ${totalTransactionsBefore === totalTransactionsAfter ? '✅ YES' : '❌ NO'} (${totalTransactionsBefore} → ${totalTransactionsAfter})`);
      console.log(`  • Status updated to COMPLETED: ${updatedTransaction.status === 'COMPLETED' ? '✅ YES' : '❌ NO'}`);
      console.log(`  • Type updated to CREDIT: ${updatedTransaction.transaction_type === 'CREDIT' ? '✅ YES' : '❌ NO'}`);
      
      if (totalTransactionsBefore === totalTransactionsAfter && 
          updatedTransaction.status === 'COMPLETED' && 
          updatedTransaction.transaction_type === 'CREDIT') {
        console.log('\n🎉 PERFECT! The approval process now correctly updates the existing transaction instead of creating a new one!');
      } else {
        console.log('\n⚠️ Some issues still remain to be fixed');
      }
    } else {
      console.log('\n❌ ISSUE: Updated transaction not found');
    }
    
    // Step 5: Verify pending payment status
    console.log('\n📝 Step 5: Checking pending payment status...');
    const amlAfterResponse = await fetch('http://localhost:3200/api/aml/pending-payments');
    const amlAfterData = await amlAfterResponse.json();
    
    const remainingPending = amlAfterData.data.pendingPayments.length;
    console.log(`📊 Pending payments remaining: ${remainingPending}`);
    
    if (remainingPending === 0) {
      console.log('✅ Pending payment was successfully processed and removed from pending list');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testApprovalFixed();

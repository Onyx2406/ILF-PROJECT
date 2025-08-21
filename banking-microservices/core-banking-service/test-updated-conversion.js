// Test the updated currency conversion system with consistent amounts
const testUpdatedCurrencyConversion = async () => {
  console.log('🧪 Testing Updated Currency Conversion System\n');

  try {
    // Send USD payment to PKR account (Account ID 45)
    const pkrWalletId = '6f1b9b81-f5a0-42b0-9886-8a7882d93ff5';
    
    console.log('📝 Step 1: Sending USD payment to PKR account...');
    const conversionWebhook = {
      id: 'test-updated-conversion-001',
      type: 'incoming_payment.completed',
      data: {
        id: 'payment-updated-conversion-001',
        walletAddressId: pkrWalletId,
        client: 'Updated Currency Conversion Test',
        incomingAmount: {
          value: '7500', // USD 75.00
          assetCode: 'USD',
          assetScale: 2
        },
        receivedAmount: {
          value: '7500',
          assetCode: 'USD', 
          assetScale: 2
        },
        metadata: {
          description: 'Testing updated currency conversion with consistent amounts'
        }
      }
    };

    const conversionResponse = await fetch('http://localhost:3200/api/webhooks/rafiki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversionWebhook)
    });

    const conversionResult = await conversionResponse.json();
    console.log('✅ Webhook Response:', JSON.stringify(conversionResult, null, 2));

    // Wait for processing
    console.log('\n⏳ Waiting 3 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check pending payments
    console.log('\n📝 Step 2: Checking pending payments...');
    const amlResponse = await fetch('http://localhost:3200/api/aml/pending-payments');
    const amlData = await amlResponse.json();
    
    const newPayment = amlData.data.pendingPayments.find(p => 
      p.senderInfo?.client === 'Updated Currency Conversion Test'
    );
    
    if (newPayment) {
      console.log('\n🎯 UPDATED CONVERSION PAYMENT FOUND!');
      console.log(`• Payment ID: ${newPayment.id}`);
      console.log(`• Final Amount: ${newPayment.currency} ${newPayment.amount}`);
      console.log(`• Original Amount: ${newPayment.originalAmount} ${newPayment.originalCurrency}`);
      console.log(`• Conversion Rate: ${newPayment.conversionRate}`);
      console.log(`• Account: ${newPayment.accountIban}`);
      
      if (newPayment.originalAmount && newPayment.conversionRate) {
        const expectedAmount = newPayment.originalAmount * newPayment.conversionRate;
        console.log(`• Conversion Check: $${newPayment.originalAmount} × ${newPayment.conversionRate} = ${newPayment.currency} ${expectedAmount}`);
        console.log(`• Actual Amount: ${newPayment.currency} ${newPayment.amount}`);
        console.log(`• Match: ${Math.abs(expectedAmount - newPayment.amount) < 0.01 ? '✅ YES' : '❌ NO'}`);
      }
    }

    // Check transactions
    console.log('\n📝 Step 3: Checking transactions...');
    const transactionsResponse = await fetch('http://localhost:3200/api/transactions?limit=3');
    const transactionsData = await transactionsResponse.json();
    
    const newTransaction = transactionsData.data.transactions.find(t => 
      t.description.includes('payment-updated-conversion-001')
    );
    
    if (newTransaction) {
      console.log('\n💳 TRANSACTION RECORD FOUND!');
      console.log(`• Transaction ID: ${newTransaction.id}`);
      console.log(`• Amount: ${newTransaction.currency} ${newTransaction.amount}`);
      console.log(`• Original Amount: ${newTransaction.original_amount} ${newTransaction.original_currency}`);
      console.log(`• Conversion Rate: ${newTransaction.conversion_rate}`);
      console.log(`• Balance After: ${newTransaction.balance_after}`);
      console.log(`• Status: ${newTransaction.status}`);
      
      if (newPayment && newTransaction) {
        const amountsMatch = Math.abs(parseFloat(newPayment.amount) - parseFloat(newTransaction.amount)) < 0.01;
        const currenciesMatch = newPayment.currency === newTransaction.currency;
        const ratesMatch = Math.abs(parseFloat(newPayment.conversionRate || 0) - parseFloat(newTransaction.conversion_rate || 0)) < 0.000001;
        
        console.log('\n🔍 CONSISTENCY CHECK:');
        console.log(`• Amounts Match: ${amountsMatch ? '✅ YES' : '❌ NO'} (${newPayment.amount} vs ${newTransaction.amount})`);
        console.log(`• Currencies Match: ${currenciesMatch ? '✅ YES' : '❌ NO'} (${newPayment.currency} vs ${newTransaction.currency})`);
        console.log(`• Rates Match: ${ratesMatch ? '✅ YES' : '❌ NO'} (${newPayment.conversionRate} vs ${newTransaction.conversion_rate})`);
        
        if (amountsMatch && currenciesMatch && ratesMatch) {
          console.log('\n🎉 SUCCESS! Amounts are now consistent between pending_payments and transactions tables!');
        } else {
          console.log('\n⚠️ There are still some inconsistencies to resolve.');
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testUpdatedCurrencyConversion();

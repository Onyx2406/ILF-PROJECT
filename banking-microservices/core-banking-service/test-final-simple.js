// Simple currency conversion test
const testCurrencyConversion = async () => {
  console.log('🧪 Simple Currency Conversion Test\n');

  try {
    // Step 1: Check existing PKR accounts
    console.log('📝 Step 1: Checking existing PKR accounts...');
    const accountsResponse = await fetch('http://localhost:3200/api/customers/6/accounts');
    const accountsText = await accountsResponse.text();
    
    let accountsData;
    try {
      accountsData = JSON.parse(accountsText);
    } catch (e) {
      console.log('❌ Failed to parse accounts response:', accountsText.substring(0, 200));
      return;
    }
    
    if (accountsData.success) {
      const pkrAccounts = accountsData.data.filter(acc => acc.currency === 'PKR');
      console.log(`✅ Found ${pkrAccounts.length} PKR accounts`);
      
      if (pkrAccounts.length > 0) {
        const testAccount = pkrAccounts[0]; // Use first PKR account
        console.log(`📋 Using Account: ID ${testAccount.id}, Currency: ${testAccount.currency}, IBAN: ${testAccount.iban}`);
        
        // Step 2: Send USD payment to PKR account via webhook
        console.log('\n📝 Step 2: Sending USD payment to PKR account...');
        const conversionWebhook = {
          id: 'test-simple-conversion-001',
          type: 'incoming.payment.completed',
          data: {
            id: 'payment-simple-conversion-001',
            walletAddressId: testAccount.wallet_address_id || testAccount.iban, // Use IBAN as fallback
            client: 'Simple USD to PKR Test',
            incomingAmount: {
              value: '15000', // USD 150.00
              assetCode: 'USD',
              assetScale: 2
            },
            receivedAmount: {
              value: '15000',
              assetCode: 'USD', 
              assetScale: 2
            },
            metadata: {
              description: 'Simple currency conversion test - USD to PKR'
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

        // Step 3: Wait and check AML
        console.log('\n⏳ Waiting 3 seconds for processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 4: Check for new pending payment
        console.log('\n📝 Step 3: Checking for new pending payment...');
        const amlResponse = await fetch('http://localhost:3200/api/aml/pending-payments');
        const amlData = await amlResponse.json();
        
        const newPayment = amlData.data.pendingPayments.find(p => 
          p.senderInfo?.client === 'Simple USD to PKR Test'
        );
        
        if (newPayment) {
          console.log('\n🎯 NEW PAYMENT FOUND!');
          console.log(`• Payment ID: ${newPayment.id}`);
          console.log(`• Amount: ${newPayment.currency} ${newPayment.amount}`);
          console.log(`• Account: ${newPayment.accountIban}`);
          console.log(`• Original Amount: ${newPayment.originalAmount || 'N/A'} ${newPayment.originalCurrency || 'N/A'}`);
          console.log(`• Conversion Rate: ${newPayment.conversionRate || 'N/A'}`);
          
          if (newPayment.originalCurrency === 'USD' && newPayment.currency === 'PKR') {
            console.log('\n💱 SUCCESS! Currency conversion detected:');
            console.log(`• $${newPayment.originalAmount} USD → ₨${newPayment.amount} PKR`);
            console.log(`• Conversion Rate: ${newPayment.conversionRate}`);
            console.log('✅ The complete currency conversion system is working!');
          } else {
            console.log('\n⚠️ Payment processed but currency details:');
            console.log(`• Expected: USD → PKR`);
            console.log(`• Actual: ${newPayment.originalCurrency || 'N/A'} → ${newPayment.currency}`);
          }
        } else {
          console.log('\n❌ New payment not found. Available payments:');
          amlData.data.pendingPayments.slice(0, 3).forEach(p => {
            console.log(`  • ${p.senderInfo?.client || p.paymentReference}: ${p.currency} ${p.amount}`);
          });
        }
      } else {
        console.log('❌ No PKR accounts found for customer 6');
      }
    } else {
      console.log('❌ Failed to get accounts:', accountsData);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testCurrencyConversion();

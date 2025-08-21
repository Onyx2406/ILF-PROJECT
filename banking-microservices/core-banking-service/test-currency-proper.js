// Test currency conversion with properly linked accounts
const testCurrencyConversionProper = async () => {
  console.log('🧪 Testing Currency Conversion with Proper Account Linking\n');

  try {
    // Step 1: Create a PKR account with a specific wallet_id
    console.log('📝 Step 1: Creating PKR account with wallet_id...');
    const walletId = 'test-pkr-wallet-001';
    
    const createPKRResponse = await fetch('http://localhost:3200/api/customers/6/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'PKR',
        initial_balance: 1000,
        wallet_id: walletId // Ensure this account has the wallet_id we'll use
      })
    });
    
    const pkrAccountData = await createPKRResponse.json();
    console.log('✅ PKR Account created:', pkrAccountData);
    
    // Step 2: Verify the account was created with PKR currency
    console.log('\n📝 Step 2: Verifying account currency...');
    const accountsResponse = await fetch('http://localhost:3200/api/customers/6/accounts');
    const accountsData = await accountsResponse.json();
    
    if (accountsData.success && accountsData.data.accounts) {
      const pkrAccounts = accountsData.data.accounts.filter(acc => acc.currency === 'PKR');
      console.log(`✅ Found ${pkrAccounts.length} PKR accounts`);
      
      if (pkrAccounts.length > 0) {
        const testAccount = pkrAccounts[pkrAccounts.length - 1]; // Use the latest PKR account
        console.log(`📋 Test Account: ID ${testAccount.id}, Currency: ${testAccount.currency}, Balance: ${testAccount.balance}`);
        
        // Step 3: Send USD payment using the actual account's wallet_id
        console.log('\n📝 Step 3: Sending USD payment to PKR account...');
        const conversionWebhook = {
          id: 'test-conversion-proper-001',
          type: 'incoming.payment.completed',
          data: {
            id: 'payment-conversion-proper-001',
            walletAddressId: testAccount.wallet_id || walletId, // Use actual wallet_id
            client: 'USD to PKR Conversion Test - Proper',
            incomingAmount: {
              value: '10000', // USD 100.00
              assetCode: 'USD',
              assetScale: 2
            },
            receivedAmount: {
              value: '10000',
              assetCode: 'USD', 
              assetScale: 2
            },
            metadata: {
              description: 'Currency conversion test - USD to PKR (proper account linking)'
            }
          }
        };

        const conversionResponse = await fetch('http://localhost:3200/api/webhooks/rafiki', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conversionWebhook)
        });

        const conversionResult = await conversionResponse.json();
        console.log('✅ Conversion Webhook Response:', JSON.stringify(conversionResult, null, 2));

        // Step 4: Wait and check processing
        console.log('\n⏳ Waiting for currency conversion processing...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 5: Check AML for converted payment
        console.log('\n📝 Step 4: Checking AML for converted payment...');
        const amlResponse = await fetch('http://localhost:3200/api/aml/pending-payments');
        const amlData = await amlResponse.json();
        
        const conversionPayment = amlData.data.pendingPayments.find(p => 
          p.senderInfo?.metadata?.description?.includes('proper account linking')
        );
        
        if (conversionPayment) {
          console.log('\n🎯 Currency Conversion FOUND!');
          console.log(`• Payment ID: ${conversionPayment.id}`);
          console.log(`• Final Amount: ${conversionPayment.currency} ${conversionPayment.amount}`);
          console.log(`• Original Amount: ${conversionPayment.originalAmount} ${conversionPayment.originalCurrency || 'N/A'}`);
          console.log(`• Conversion Rate: ${conversionPayment.conversionRate || 'N/A'}`);
          console.log(`• Account ID: ${conversionPayment.accountId}`);
          
          if (conversionPayment.currency === 'PKR' && conversionPayment.originalCurrency === 'USD') {
            console.log('\n💱 SUCCESS! Currency conversion working:');
            console.log(`• $${conversionPayment.originalAmount} USD → ₨${conversionPayment.amount} PKR`);
            console.log(`• Rate: ${conversionPayment.conversionRate}`);
            console.log('✅ Complete currency conversion system is operational!');
          } else {
            console.log('\n⚠️ Payment processed but conversion details not as expected');
            console.log(`• Expected: USD → PKR conversion`);
            console.log(`• Actual: ${conversionPayment.originalCurrency || 'N/A'} → ${conversionPayment.currency}`);
          }
        } else {
          console.log('\n❌ Conversion payment not found in AML');
          console.log('📋 Available payments:');
          amlData.data.pendingPayments.forEach(p => {
            console.log(`  • ID ${p.id}: ${p.currency} ${p.amount} (${p.paymentReference})`);
          });
        }

        // Step 6: Check webhook status
        console.log('\n📝 Step 5: Checking webhook processing status...');
        const webhooksResponse = await fetch('http://localhost:3200/api/webhooks/rafiki?limit=3');
        const webhooksData = await webhooksResponse.json();
        
        const ourWebhook = webhooksData.data.webhooks.find(w => w.data?.id === 'payment-conversion-proper-001');
        if (ourWebhook) {
          console.log(`📊 Webhook Status: ${ourWebhook.status}`);
          if (ourWebhook.errorMessage) {
            console.log(`❌ Error: ${ourWebhook.errorMessage}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testCurrencyConversionProper();

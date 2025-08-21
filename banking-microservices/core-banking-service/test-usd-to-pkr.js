// Test USD to PKR currency conversion with actual PKR account
const testUSDtoPKRConversion = async () => {
  console.log('🧪 Testing USD to PKR Currency Conversion\n');

  try {
    // Use the PKR account with wallet_id (Account ID 30)
    const pkrWalletId = '5b0aa41c-4e75-441d-b03a-a270fba288d6';
    const pkrAccountId = 30;
    
    console.log(`📝 Target: PKR Account ID ${pkrAccountId} with wallet_id: ${pkrWalletId}`);
    
    // Step 1: Send USD payment to PKR account for currency conversion
    console.log('\n📝 Step 1: Sending USD payment to PKR account...');
    const conversionWebhook = {
      id: 'test-usd-to-pkr-conversion-001',
      type: 'incoming.payment.completed',
      data: {
        id: 'payment-usd-to-pkr-conversion-001',
        walletAddressId: pkrWalletId,
        client: 'USD to PKR Currency Conversion Test',
        incomingAmount: {
          value: '17500', // USD 175.00
          assetCode: 'USD',
          assetScale: 2
        },
        receivedAmount: {
          value: '17500',
          assetCode: 'USD', 
          assetScale: 2
        },
        metadata: {
          description: 'Real USD to PKR currency conversion test'
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

    // Step 2: Wait for currency conversion processing
    console.log('\n⏳ Waiting 5 seconds for currency conversion processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Check for currency converted payment in AML
    console.log('\n📝 Step 2: Checking for currency converted payment in AML...');
    const amlResponse = await fetch('http://localhost:3200/api/aml/pending-payments');
    const amlData = await amlResponse.json();
    
    const conversionPayment = amlData.data.pendingPayments.find(p => 
      p.senderInfo?.client === 'USD to PKR Currency Conversion Test'
    );
    
    if (conversionPayment) {
      console.log('\n🎯 CURRENCY CONVERSION PAYMENT FOUND!');
      console.log(`• Payment ID: ${conversionPayment.id}`);
      console.log(`• Final Amount: ₨${conversionPayment.amount} PKR`);
      console.log(`• Account: ${conversionPayment.accountIban} (ID: ${conversionPayment.accountId})`);
      console.log(`• Original Amount: $${conversionPayment.originalAmount || 'N/A'} ${conversionPayment.originalCurrency || 'N/A'}`);
      console.log(`• Conversion Rate: ${conversionPayment.conversionRate || 'N/A'}`);
      
      if (conversionPayment.originalCurrency === 'USD' && conversionPayment.currency === 'PKR') {
        console.log('\n💱 SUCCESS! CURRENCY CONVERSION WORKING!');
        console.log(`• Converted: $${conversionPayment.originalAmount} USD → ₨${conversionPayment.amount} PKR`);
        console.log(`• Exchange Rate: 1 USD = ${conversionPayment.conversionRate} PKR`);
        console.log(`• Account Type: PKR account (ID: ${conversionPayment.accountId})`);
        console.log('✅ THE COMPLETE CURRENCY CONVERSION SYSTEM IS OPERATIONAL!');
        
        // Calculate expected PKR amount
        const expectedPKR = parseFloat(conversionPayment.originalAmount) * parseFloat(conversionPayment.conversionRate);
        console.log(`• Calculation Check: $${conversionPayment.originalAmount} × ${conversionPayment.conversionRate} = ₨${expectedPKR.toFixed(2)}`);
        
      } else {
        console.log('\n⚠️ Payment processed but conversion details unexpected:');
        console.log(`• Expected: USD → PKR conversion`);
        console.log(`• Actual: ${conversionPayment.originalCurrency || 'N/A'} → ${conversionPayment.currency}`);
      }
    } else {
      console.log('\n❌ Currency conversion payment not found. Available payments:');
      amlData.data.pendingPayments.slice(0, 5).forEach(p => {
        console.log(`  • ${p.senderInfo?.client || p.paymentReference}: ${p.currency} ${p.amount} (Account ${p.accountId})`);
      });
    }

    // Step 4: Check webhook status and account matching
    console.log('\n📝 Step 3: Checking webhook processing details...');
    const webhooksResponse = await fetch('http://localhost:3200/api/webhooks/rafiki?limit=1');
    const webhooksData = await webhooksResponse.json();
    
    if (webhooksData.success && webhooksData.data.webhooks.length > 0) {
      const latestWebhook = webhooksData.data.webhooks[0];
      console.log(`📊 Latest Webhook:`);
      console.log(`   • ID: ${latestWebhook.id}`);
      console.log(`   • Status: ${latestWebhook.status}`);
      console.log(`   • Account ID: ${latestWebhook.accountId}`);
      console.log(`   • Wallet Address ID: ${latestWebhook.walletAddressId}`);
      console.log(`   • Payment: ${latestWebhook.paymentCurrency} ${latestWebhook.paymentAmount}`);
      
      if (latestWebhook.errorMessage) {
        console.log(`   • Error: ${latestWebhook.errorMessage}`);
      }
      
      if (latestWebhook.accountId === pkrAccountId) {
        console.log('✅ Webhook correctly matched PKR account!');
      } else {
        console.log(`⚠️ Expected account ${pkrAccountId}, got ${latestWebhook.accountId}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testUSDtoPKRConversion();

// Test with working wallet address ID for currency conversion
const testWorkingWalletConversion = async () => {
  console.log('🧪 Testing Currency Conversion with Working Wallet Address ID\n');

  try {
    // Use the wallet address ID that we know works (from webhook 56)
    const workingWalletAddressId = '8da14227-0f6f-486d-9e9d-df4dfe9b5573';
    
    console.log(`📝 Using working wallet address ID: ${workingWalletAddressId}`);
    
    // Check what account this wallet address belongs to
    console.log('\n📝 Step 1: Checking which account this wallet belongs to...');
    const accountsResponse = await fetch('http://localhost:3200/api/customers/6/accounts');
    const accountsData = await accountsResponse.json();
    
    if (accountsData.success) {
      const targetAccount = accountsData.data.find(acc => 
        acc.wallet_address_id === workingWalletAddressId
      );
      
      if (targetAccount) {
        console.log(`✅ Found target account: ID ${targetAccount.id}, Currency: ${targetAccount.currency}, IBAN: ${targetAccount.iban}`);
        
        if (targetAccount.currency === 'PKR') {
          console.log('🎯 Perfect! This is a PKR account - currency conversion should happen');
        } else {
          console.log(`⚠️ Note: This is a ${targetAccount.currency} account - no conversion expected`);
        }
      } else {
        console.log('⚠️ Account not found in customer 6, checking account 24 directly...');
      }
    }
    
    // Step 2: Send USD payment to this wallet address for currency conversion test
    console.log('\n📝 Step 2: Sending USD payment for currency conversion...');
    const conversionWebhook = {
      id: 'test-working-wallet-conversion-001',
      type: 'incoming.payment.completed',
      data: {
        id: 'payment-working-wallet-conversion-001',
        walletAddressId: workingWalletAddressId,
        client: 'Working Wallet USD to PKR Test',
        incomingAmount: {
          value: '20000', // USD 200.00
          assetCode: 'USD',
          assetScale: 2
        },
        receivedAmount: {
          value: '20000',
          assetCode: 'USD', 
          assetScale: 2
        },
        metadata: {
          description: 'Currency conversion test with working wallet address'
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
    console.log('\n⏳ Waiting 4 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Step 4: Check for new pending payment
    console.log('\n📝 Step 3: Checking for new pending payment in AML...');
    const amlResponse = await fetch('http://localhost:3200/api/aml/pending-payments');
    const amlData = await amlResponse.json();
    
    const newPayment = amlData.data.pendingPayments.find(p => 
      p.senderInfo?.client === 'Working Wallet USD to PKR Test'
    );
    
    if (newPayment) {
      console.log('\n🎯 NEW PAYMENT FOUND!');
      console.log(`• Payment ID: ${newPayment.id}`);
      console.log(`• Final Amount: ${newPayment.currency} ${newPayment.amount}`);
      console.log(`• Account: ${newPayment.accountIban} (ID: ${newPayment.accountId})`);
      console.log(`• Original Amount: ${newPayment.originalAmount || 'N/A'} ${newPayment.originalCurrency || 'N/A'}`);
      console.log(`• Conversion Rate: ${newPayment.conversionRate || 'N/A'}`);
      
      if (newPayment.originalCurrency && newPayment.originalCurrency !== newPayment.currency) {
        console.log('\n💱 CURRENCY CONVERSION DETECTED!');
        console.log(`• ${newPayment.originalAmount} ${newPayment.originalCurrency} → ${newPayment.amount} ${newPayment.currency}`);
        console.log(`• Conversion Rate: ${newPayment.conversionRate}`);
        console.log('✅ The complete currency conversion system is operational!');
      } else if (newPayment.currency === 'USD') {
        console.log('\n💡 USD payment to USD account (no conversion needed)');
        console.log('✅ System working correctly - no conversion for same currency');
      } else {
        console.log('\n⚠️ Payment processed but conversion status unclear');
      }
    } else {
      console.log('\n❌ New payment not found. Latest payments:');
      amlData.data.pendingPayments.slice(0, 3).forEach(p => {
        console.log(`  • ${p.senderInfo?.client || p.paymentReference}: ${p.currency} ${p.amount} (Account ${p.accountId})`);
      });
    }

    // Step 5: Check webhook status
    console.log('\n📝 Step 4: Checking webhook processing status...');
    const webhooksResponse = await fetch('http://localhost:3200/api/webhooks/rafiki?limit=1');
    const webhooksData = await webhooksResponse.json();
    
    if (webhooksData.success && webhooksData.data.webhooks.length > 0) {
      const latestWebhook = webhooksData.data.webhooks[0];
      console.log(`📊 Latest Webhook: ID ${latestWebhook.id}, Status: ${latestWebhook.status}, Account ID: ${latestWebhook.accountId}`);
      if (latestWebhook.errorMessage) {
        console.log(`❌ Error: ${latestWebhook.errorMessage}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testWorkingWalletConversion();

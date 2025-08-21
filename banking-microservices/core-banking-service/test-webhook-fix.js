// Test the fixed webhook with incoming.payment.completed
const testIncomingPaymentCompleted = async () => {
  console.log('🧪 Testing Fixed incoming.payment.completed Webhook\n');

  try {
    // Create a PKR account first
    console.log('📝 Step 1: Creating PKR account...');
    const createAccountResponse = await fetch('http://localhost:3004/api/customers/1/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'PKR',
        initial_balance: 1000
      })
    });
    
    const accountData = await createAccountResponse.json();
    console.log('✅ PKR Account created:', accountData);
    
    // Step 2: Send incoming.payment.completed webhook
    console.log('\n📝 Step 2: Sending incoming.payment.completed webhook...');
    const webhookPayload = {
      id: 'test-payment-fixed-001',
      type: 'incoming.payment.completed', // Fixed: using dot instead of underscore
      data: {
        id: 'payment-fix-001',
        walletAddressId: '8da14227-0f6f-486d-9e9d-df4dfe9b5573',
        client: 'Test Client for Fixed Webhook',
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
          description: 'Test payment with fixed webhook type'
        }
      }
    };

    const webhookResponse = await fetch('http://localhost:3004/api/webhooks/rafiki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    const webhookResult = await webhookResponse.json();
    console.log('✅ Webhook Response:', JSON.stringify(webhookResult, null, 2));

    // Step 3: Wait for processing
    console.log('\n⏳ Waiting for webhook processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Check AML for new pending payment
    console.log('\n📝 Step 3: Checking AML for new pending payment...');
    const amlResponse = await fetch('http://localhost:3004/api/aml/pending-payments');
    const amlData = await amlResponse.json();
    
    // Look for our specific webhook
    const ourPayment = amlData.data.pendingPayments.find(p => 
      p.senderInfo?.metadata?.description?.includes('fixed webhook type')
    );
    
    if (ourPayment) {
      console.log('\n🎯 SUCCESS! Found our payment in AML pending:');
      console.log(`• Payment ID: ${ourPayment.id}`);
      console.log(`• Amount: ${ourPayment.currency} ${ourPayment.amount}`);
      console.log(`• Original Amount: ${ourPayment.originalAmount} ${ourPayment.originalCurrency || 'N/A'}`);
      console.log(`• Conversion Rate: ${ourPayment.conversionRate || 'N/A'}`);
      console.log(`• Risk Level: ${ourPayment.riskLevel}`);
      console.log(`• Status: ${ourPayment.status}`);
      console.log('✅ Webhook fix worked! Payment created pending transaction.');
    } else {
      console.log('\n❌ Payment not found in AML pending payments');
      console.log('📋 Current pending payments:');
      amlData.data.pendingPayments.forEach(p => {
        console.log(`  • ${p.paymentReference}: ${p.currency} ${p.amount} - ${p.status}`);
      });
    }

    // Step 5: Check webhooks list for status
    console.log('\n📝 Step 4: Checking webhook processing status...');
    const webhooksResponse = await fetch('http://localhost:3004/api/webhooks/rafiki?limit=5');
    const webhooksData = await webhooksResponse.json();
    
    console.log('📊 Recent Webhooks:');
    webhooksData.data.webhooks.slice(0, 3).forEach(w => {
      console.log(`  • ID ${w.id}: ${w.type} - Status: ${w.status} ${w.errorMessage ? `(Error: ${w.errorMessage})` : ''}`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testIncomingPaymentCompleted();

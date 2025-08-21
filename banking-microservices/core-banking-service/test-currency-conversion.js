// Currency Conversion System Test with Real Wallet Addresses
// Run this test to verify the currency conversion functionality

const testCurrencyConversion = async () => {
  console.log('🧪 Testing Currency Conversion System with Real Rafiki Integration...\n');

  try {
    // Test 1: Create a PKR account
    console.log('📝 Test 1: Creating PKR account...');
    const createAccountResponse = await fetch('http://localhost:3004/api/customers/1/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'PKR',
        initial_balance: 1000 // PKR 1000
      })
    });
    
    if (!createAccountResponse.ok) {
      throw new Error(`Failed to create account: ${createAccountResponse.statusText}`);
    }
    
    const accountData = await createAccountResponse.json();
    console.log('✅ PKR Account created:', accountData);
    
    // Test 2: Create a real incoming payment using Rafiki API
    console.log('\n📝 Test 2: Creating real incoming payment in Rafiki...');
    
    // Use real wallet address from Rafiki system
    const realWalletAddress = 'https://abl-backend/pk91abbl9776920808228022'; // From logs
    
    const createPaymentResponse = await fetch('http://localhost:4000/cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d/incoming-payments', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'GNAP 9B10B84CE58032DBE6D5' // From logs
      },
      body: JSON.stringify({
        walletAddress: realWalletAddress,
        incomingAmount: {
          value: '25.00', // USD 25
          assetCode: 'USD',
          assetScale: 2
        },
        metadata: {
          description: 'Test payment for currency conversion'
        }
      })
    });

    if (createPaymentResponse.ok) {
      const paymentData = await createPaymentResponse.json();
      console.log('✅ Real incoming payment created:', paymentData);
      
      // Wait a moment for processing
      console.log('\n⏳ Waiting for payment processing...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } else {
      console.log('⚠️ Could not create real payment, proceeding with test webhook...');
    }

    // Test 3: Simulate webhook with real wallet address
    console.log('\n📝 Test 3: Simulating USD→PKR webhook with real wallet...');
    const webhookPayload = {
      id: 'test-webhook-real-001',
      type: 'incoming.payment.completed',
      data: {
        id: 'payment-real-001',
        walletAddressId: '8da14227-0f6f-486d-9e9d-df4dfe9b5573', // From available wallet IDs
        client: 'Test Sender',
        incomingAmount: {
          value: '50.00', // USD 50
          assetCode: 'USD',
          assetScale: 2
        },
        receivedAmount: {
          value: '50.00',
          assetCode: 'USD', 
          assetScale: 2
        },
        metadata: {
          description: 'Test payment to PKR account with real wallet'
        }
      }
    };

    const webhookResponse = await fetch('http://localhost:3004/api/webhooks/rafiki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook failed: ${webhookResponse.statusText}`);
    }

    const webhookResult = await webhookResponse.json();
    console.log('✅ Webhook processed:', webhookResult);

    // Test 4: Check AML pending payments for currency conversion
    console.log('\n📝 Test 4: Checking AML pending payments for currency conversion...');
    const amlResponse = await fetch('http://localhost:3004/api/aml/pending-payments');
    
    if (!amlResponse.ok) {
      throw new Error(`AML check failed: ${amlResponse.statusText}`);
    }
    
    const amlData = await amlResponse.json();
    console.log('✅ AML Pending Payments:', JSON.stringify(amlData, null, 2));

    console.log('\n🎉 Tests completed!');
    console.log('\n📋 Results Summary:');
    console.log('• PKR account created (should auto-convert USD to PKR)');
    console.log('• Real incoming payment attempted in Rafiki');
    console.log('• Webhook sent with real wallet address');
    console.log('• Currency conversion should be visible in AML interface');
    
    console.log('\n💡 Next Steps:');
    console.log('• Check http://localhost:3031 for incoming payment approval');
    console.log('• Monitor ABL logs for incoming.payment.completed webhooks');
    console.log('• Verify currency conversion in AML interface at http://localhost:3004/aml');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testCurrencyConversion();

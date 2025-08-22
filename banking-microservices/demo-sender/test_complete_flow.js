const fetch = require('node-fetch');

async function testPayment() {
  console.log('=== TESTING COMPLETE PAYMENT FLOW ===');
  
  try {
    // Step 1: Create Receiver
    console.log('\n1. Creating receiver...');
    const receiverRes = await fetch('http://localhost:3400/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation CreateReceiver($input: CreateReceiverInput!) {
          createReceiver(input: $input) {
            receiver {
              id
              walletAddressUrl
              metadata
              completed
              __typename
            }
            __typename
          }
        }`,
        variables: {
          input: {
            metadata: { description: "test-payment" },
            incomingAmount: { assetCode: "USD", assetScale: 2, value: 500 },
            walletAddressUrl: "https://abl-backend/PK47ABBL8950311861785523"
          }
        }
      })
    });
    
    const receiverResult = await receiverRes.json();
    if (receiverResult.errors) {
      console.error('❌ Receiver creation failed:', receiverResult.errors[0].message);
      return false;
    }
    
    const receiver = receiverResult.data.createReceiver.receiver;
    console.log('✅ Receiver created:', receiver.id);
    
    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Create Quote
    console.log('\n2. Creating quote...');
    const quoteRes = await fetch('http://localhost:3400/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation CreateQuote($input: CreateQuoteInput!) {
          createQuote(input: $input) {
            quote {
              id
              walletAddressId
              receiver
              debitAmount { assetCode assetScale value }
              receiveAmount { assetCode assetScale value }
              __typename
            }
            __typename
          }
        }`,
        variables: {
          input: {
            walletAddressId: "2cf06058-a987-4914-8ea7-449a4137dc19",
            receiver: receiver.id
          }
        }
      })
    });
    
    const quoteResult = await quoteRes.json();
    if (quoteResult.errors) {
      console.error('❌ Quote creation failed:', quoteResult.errors[0].message);
      return false;
    }
    
    const quote = quoteResult.data.createQuote.quote;
    console.log('✅ Quote created:', quote.id);
    console.log('   Debit amount:', quote.debitAmount.value, quote.debitAmount.assetCode);
    console.log('   Receive amount:', quote.receiveAmount.value, quote.receiveAmount.assetCode);
    
    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 3: Create Outgoing Payment
    console.log('\n3. Creating outgoing payment...');
    const paymentRes = await fetch('http://localhost:3400/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation CreateOutgoingPayment($input: CreateOutgoingPaymentInput!) {
          createOutgoingPayment(input: $input) {
            payment {
              id
              walletAddressId
              receiver
              state
              debitAmount { assetCode assetScale value }
              receiveAmount { assetCode assetScale value }
              __typename
            }
            __typename
          }
        }`,
        variables: {
          input: {
            walletAddressId: "2cf06058-a987-4914-8ea7-449a4137dc19",
            quoteId: quote.id
          }
        }
      })
    });
    
    const paymentResult = await paymentRes.json();
    if (paymentResult.errors) {
      console.error('❌ Payment creation failed:', paymentResult.errors[0].message);
      return false;
    }
    
    const payment = paymentResult.data.createOutgoingPayment.payment;
    console.log('✅ Outgoing payment created:', payment.id);
    console.log('   Payment state:', payment.state);
    console.log('   Receiver URL:', payment.receiver);
    
    // Wait 3 seconds for auto-funding
    console.log('\n   Waiting 3 seconds for auto-funding...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Create Withdrawal
    console.log('\n4. Creating withdrawal...');
    const receiverUrl = payment.receiver;
    const paymentId = receiverUrl.split('/incoming-payments/')[1];
    console.log('   Using incoming payment ID:', paymentId);
    
    const withdrawalRes = await fetch('http://localhost:3400/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation CreateIncomingPaymentWithdrawal($input: CreateIncomingPaymentWithdrawalInput!) {
          createIncomingPaymentWithdrawal(input: $input) {
            success
            __typename
          }
        }`,
        variables: {
          input: {
            incomingPaymentId: paymentId,
            idempotencyKey: "test-" + Date.now(),
            timeoutSeconds: 10
          }
        }
      })
    });
    
    const withdrawalResult = await withdrawalRes.json();
    if (withdrawalResult.errors) {
      console.error('❌ Withdrawal failed:', withdrawalResult.errors[0].message);
      return false;
    }
    
    if (withdrawalResult.data.createIncomingPaymentWithdrawal.success) {
      console.log('✅ Withdrawal completed successfully');
      console.log('\n🎉 ALL 4 STEPS COMPLETED!');
      console.log('   This should trigger incoming.payment.completed webhook');
      return true;
    } else {
      console.error('❌ Withdrawal returned success: false');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

testPayment().then(success => {
  console.log('\n=== TEST RESULT ===');
  console.log(success ? '✅ PAYMENT FLOW TEST PASSED' : '❌ PAYMENT FLOW TEST FAILED');
  process.exit(success ? 0 : 1);
});

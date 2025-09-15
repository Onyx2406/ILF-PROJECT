// Test creating a real payment through Rafiki that should trigger completion webhook
const crypto = require('crypto');

const createSignedGraphQLRequest = (query, variables, secret, tenantId) => {
  const timestamp = Date.now();
  const version = '1';
  
  const formattedRequest = {
    variables,
    operationName: null,
    query: query
  };
  
  // JSON canonicalize (simple version)
  const canonicalize = (obj) => JSON.stringify(obj, Object.keys(obj).sort());
  
  const payload = `${timestamp}.${canonicalize(formattedRequest)}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  
  return {
    headers: {
      'Content-Type': 'application/json',
      'signature': `t=${timestamp}, v${version}=${digest}`,
      'tenant-id': tenantId
    },
    body: JSON.stringify(formattedRequest)
  };
};

const testRealPaymentFlow = async () => {
  console.log('🚀 Testing Real Payment Flow: GraphQL → Completion Webhook → Currency Conversion\n');

  try {
    // Step 1: Create incoming payment via GraphQL with proper authentication
    console.log('📝 Step 1: Creating incoming payment via Rafiki GraphQL...');
    
    const createPaymentQuery = `
      mutation CreateIncomingPayment($input: CreateIncomingPaymentInput!) {
        createIncomingPayment(input: $input) {
          payment {
            id
            walletAddressId
            state
            incomingAmount {
              value
              assetCode
            }
            receivedAmount {
              value
              assetCode
            }
            metadata
          }
        }
      }
    `;

    const variables = {
      input: {
        walletAddressId: "97a3a431-8ee1-48fc-ac85-70e2f5eba8e5", // Philip Fry's account
        incomingAmount: {
          value: "2500", // $25.00
          assetCode: "USD",
          assetScale: 2
        },
        metadata: {
          description: "Test payment for webhook completion flow",
          sender: "Test Client"
        }
      }
    };

    // Use the same secret and tenant ID as Mock ASE
    const apiSecret = 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=';
    const tenantId = process.env.OPERATOR_TENANT_ID || 'happy-life-bank';
    
    const signedRequest = createSignedGraphQLRequest(createPaymentQuery, variables, apiSecret, tenantId);

    const graphqlResponse = await fetch('http://localhost:3001/graphql', {
      method: 'POST',
      headers: signedRequest.headers,
      body: signedRequest.body
    });

    if (!graphqlResponse.ok) {
      const errorText = await graphqlResponse.text();
      throw new Error(`GraphQL request failed: ${graphqlResponse.status} ${graphqlResponse.statusText} - ${errorText}`);
    }

    const graphqlResult = await graphqlResponse.json();
    console.log('✅ Incoming payment created:', JSON.stringify(graphqlResult, null, 2));

    if (graphqlResult.errors) {
      console.error('❌ GraphQL errors:', graphqlResult.errors);
      return;
    }

    const paymentId = graphqlResult.data?.createIncomingPayment?.payment?.id;
    if (!paymentId) {
      console.error('❌ No payment ID returned');
      return;
    }

    console.log(`🆔 Payment ID: ${paymentId}`);

    // Step 2: Wait a moment for processing
    console.log('\n⏳ Waiting for automatic processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Check if we can manually complete the payment if it's still pending
    console.log('\n📝 Step 2: Checking payment status and attempting completion...');
    
    const completePaymentQuery = `
      mutation ApproveIncomingPayment($input: ApproveIncomingPaymentInput!) {
        approveIncomingPayment(input: $input) {
          payment {
            id
            state
            receivedAmount {
              value
              assetCode
            }
          }
        }
      }
    `;

    const approvalVariables = {
      input: {
        id: paymentId,
        receivedAmount: {
          value: "2500",
          assetCode: "USD",
          assetScale: 2
        }
      }
    };

    const signedApprovalRequest = createSignedGraphQLRequest(completePaymentQuery, approvalVariables, apiSecret, tenantId);

    const approvalResponse = await fetch('http://localhost:3001/graphql', {
      method: 'POST',
      headers: signedApprovalRequest.headers,
      body: signedApprovalRequest.body
    });

    if (approvalResponse.ok) {
      const approvalResult = await approvalResponse.json();
      console.log('✅ Payment approval attempted:', JSON.stringify(approvalResult, null, 2));
    } else {
      const errorText = await approvalResponse.text();
      console.log(`⚠️ Payment approval failed: ${approvalResponse.status} - ${errorText}`);
    }

    // Step 4: Wait for webhook processing
    console.log('\n⏳ Waiting for webhook processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 5: Check AML interface for the payment
    console.log('\n📝 Step 3: Checking AML interface for completed payment...');
    const amlResponse = await fetch('http://localhost:3004/api/aml/pending-payments');
    
    if (amlResponse.ok) {
      const amlData = await amlResponse.json();
      console.log('✅ AML Pending Payments:', JSON.stringify(amlData, null, 2));
      
      // Look for our payment
      const ourPayment = amlData.data.pendingPayments.find(p => 
        p.senderInfo?.metadata?.description?.includes('Test payment for webhook completion flow')
      );
      
      if (ourPayment) {
        console.log('\n🎯 Found our payment in AML:');
        console.log(`• Amount: ${ourPayment.currency} ${ourPayment.amount}`);
        console.log(`• Risk Level: ${ourPayment.riskLevel}`);
        console.log(`• Status: ${ourPayment.status}`);
        console.log(`• Auto-approval eligible: ${ourPayment.autoApprovalEligible}`);
      } else {
        console.log('\n⚠️ Our payment not found in pending payments - might be auto-processed');
      }
    }

    // Step 6: Check completed transactions
    console.log('\n📝 Step 4: Checking completed transactions...');
    const completedResponse = await fetch('http://localhost:3004/api/aml/completed-payments');
    
    if (completedResponse.ok) {
      const completedData = await completedResponse.json();
      console.log('✅ Completed Payments:', JSON.stringify(completedData, null, 2));
    }

    console.log('\n🎉 Real payment flow test completed!');
    console.log('\n📋 Summary:');
    console.log('• Created real incoming payment via GraphQL');
    console.log('• Attempted approval/completion');
    console.log('• Checked for webhook processing in AML system');
    console.log('• Should see incoming.payment.completed webhook if everything worked');

  } catch (error) {
    console.error('❌ Real payment test failed:', error.message);
  }
};

// Run the test
testRealPaymentFlow();

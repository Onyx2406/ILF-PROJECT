// Test script to approve incoming payments and trigger completion webhooks

const approveIncomingPayment = async (paymentId) => {
  const query = `
    mutation ApproveIncomingPayment($input: ApproveIncomingPaymentInput!) {
      approveIncomingPayment(input: $input) {
        payment {
          id
          completed
          receivedAmount {
            value
            assetCode
          }
          state
        }
      }
    }
  `;

  const variables = {
    input: {
      id: paymentId
    }
  };

  try {
    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json();
    console.log('✅ Payment approval result:', JSON.stringify(result, null, 2));
    
    if (result.data?.approveIncomingPayment?.payment?.completed) {
      console.log('🎉 Payment completed! incoming.payment.completed webhook should be sent now.');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error approving payment:', error);
  }
};

// Get list of payments first
const getIncomingPayments = async () => {
  const query = `
    query {
      incomingPayments(first: 10) {
        edges {
          node {
            id
            state
            completed
            receivedAmount {
              value
              assetCode
            }
            incomingAmount {
              value
              assetCode
            }
            walletAddress {
              id
              url
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    const result = await response.json();
    console.log('📋 Current incoming payments:', JSON.stringify(result, null, 2));
    
    // Find pending payments
    const pendingPayments = result.data?.incomingPayments?.edges?.filter(
      edge => !edge.node.completed && edge.node.state === 'PENDING'
    ) || [];
    
    console.log(`\n🔍 Found ${pendingPayments.length} pending payments that need approval.`);
    
    // Approve each pending payment
    for (const payment of pendingPayments) {
      console.log(`\n⏳ Approving payment: ${payment.node.id}`);
      await approveIncomingPayment(payment.node.id);
      
      // Wait a bit between approvals
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error getting payments:', error);
  }
};

// Run the approval process
console.log('🚀 Starting payment approval process...\n');
getIncomingPayments();

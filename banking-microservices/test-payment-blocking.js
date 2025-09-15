const fetch = require('node-fetch');

async function testPaymentBlocking() {
  console.log('💳 Testing payment blocking functionality...\n');
  
  const testPayments = [
    {
      name: 'Usama Bin Laden',
      amount: 1000,
      description: 'Should be blocked - sanctioned individual'
    },
    {
      name: 'Taliban Representative',
      amount: 500,
      description: 'Should be blocked - contains Taliban'
    },
    {
      name: 'John Smith',
      amount: 250,
      description: 'Should be allowed - legitimate name'
    },
    {
      name: 'Al-Qaeda Member',
      amount: 750,
      description: 'Should be blocked - contains Al-Qaeda'
    }
  ];
  
  for (const payment of testPayments) {
    try {
      // Simulate incoming payment processing
      console.log(`🔍 Processing payment from: "${payment.name}" ($${payment.amount})`);
      console.log(`   Description: ${payment.description}`);
      
      // Check if sender is blocked
      const blockCheckResponse = await fetch('http://localhost:3200/api/test-block-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderName: payment.name })
      });
      
      const blockResult = await blockCheckResponse.json();
      
      if (blockResult.isBlocked) {
        console.log(`   🚫 PAYMENT BLOCKED: ${blockResult.blockReason}`);
        console.log(`   💾 Recording blocked payment in database...`);
        
        // Here we would record the blocked payment
        // For now, just simulate the logging
        console.log(`   📝 Blocked payment logged: ${payment.name} - $${payment.amount}`);
      } else {
        console.log(`   ✅ PAYMENT ALLOWED: Processing normally`);
        console.log(`   💰 Payment of $${payment.amount} from ${payment.name} approved`);
      }
      
      console.log(''); // Empty line for readability
      
    } catch (error) {
      console.error(`   ❌ Error processing payment from ${payment.name}:`, error.message);
    }
  }
  
  console.log('📊 Payment blocking test completed!');
}

// Run the test
testPaymentBlocking();

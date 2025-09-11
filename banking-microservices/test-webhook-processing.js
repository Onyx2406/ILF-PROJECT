// Test the exact webhook data that was received
const webhookData = {
  "id": "3a09e67b-c42e-4735-9f28-4c16d7b9b038",
  "client": "https://cloud-nine-wallet-backend/.well-known/pay",
  "metadata": {
    "senderName": "Usama bin Ladin",
    "description": "Bank of America cross-currency payment",
    "senderWalletAddress": "https://bankofamerica.com/john.doe"
  },
  "completed": true,
  "createdAt": "2025-09-09T08:49:05.758Z",
  "expiresAt": "2025-10-09T08:49:05.756Z",
  "incomingAmount": {
    "value": "500",
    "assetCode": "USD",
    "assetScale": 2
  },
  "receivedAmount": {
    "value": "500",
    "assetCode": "USD",
    "assetScale": 2
  },
  "walletAddressId": "4ed7df8b-0a62-4779-864d-245b7baa473b"
};

/**
 * Extract names for AIML fraud detection (both sender and receiver)
 */
function extractReceiverName(paymentData, account) {
  console.log('🔍 Extracting name from payment data:', JSON.stringify(paymentData, null, 2));
  
  // PRIORITY 1: Explicit sender names (most likely to contain suspicious entities)
  const senderNames = [
    paymentData.metadata?.senderName,
    paymentData.metadata?.Name, // Capital N as used in demo sender
    paymentData.senderName,
    paymentData.sender?.name
  ];
  
  for (const name of senderNames) {
    if (name && typeof name === 'string' && name.trim().length > 0) {
      const cleanName = name.trim();
      if (cleanName.length > 2 && !cleanName.includes('http') && !cleanName.toLowerCase().includes('payment')) {
        console.log(`🔍 AIML: Found sender name for fraud check: ${cleanName}`);
        return cleanName;
      }
    }
  }
  
  console.log('⚠️ AIML: No suitable name found for fraud checking');
  return null;
}

// Test the function
const extractedName = extractReceiverName(webhookData);
console.log('\n🎯 Final result:', extractedName);

// Test the block check
if (extractedName) {
  console.log('\n📡 Testing block check API...');
  
  fetch('http://localhost:3200/api/test-block-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderName: extractedName })
  })
  .then(response => response.json())
  .then(result => {
    console.log('✅ Block check result:', result);
    
    if (result.isBlocked) {
      console.log('🚫 Payment should have been BLOCKED!');
    } else {
      console.log('✅ Payment would be allowed');
    }
  })
  .catch(error => {
    console.error('❌ Error testing block check:', error);
  });
} else {
  console.log('❌ No name extracted - can\'t test block checking');
}

const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'abl_cbs',
  port: 5434,
});

// Simulate the webhook data structure
const testWebhookData = {
  id: "test-payment-osama-123",
  client: "Test Client",
  metadata: {
    senderName: "Osama bin Laden",
    description: "Test payment from blocked entity"
  },
  receivedAmount: {
    value: "100000",
    assetCode: "USD", 
    assetScale: 2
  },
  walletAddressId: "b432a9ce-b4c8-40a6-8c6f-8dc241dec326"
};

// Extract names function (from the updated webhook code)
function extractReceiverName(paymentData, account) {
  const possibleNames = [
    // Receiver fields
    paymentData.receiverName,
    paymentData.receiver?.name,
    paymentData.metadata?.receiverName,
    account?.name,
    account?.customer?.name,
    
    // Sender fields (from demo sender metadata)
    paymentData.metadata?.senderName,
    paymentData.metadata?.Name,
    paymentData.senderName,
    paymentData.sender?.name,
    
    // General description fields that might contain names
    paymentData.metadata?.description,
    paymentData.description,
    paymentData.client
  ];
  
  for (const name of possibleNames) {
    if (name && typeof name === 'string' && name.trim().length > 0) {
      const cleanName = name.trim();
      if (cleanName.length > 2 && !cleanName.includes('http') && !cleanName.includes('payment')) {
        return cleanName;
      }
    }
  }
  
  return null;
}

// Simple name matching function
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function testFraudDetection() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing fraud detection...');
    
    // Extract name from webhook data
    const extractedName = extractReceiverName(testWebhookData);
    console.log(`📝 Extracted name: "${extractedName}"`);
    
    if (!extractedName) {
      console.log('❌ No name extracted from webhook data!');
      return;
    }
    
    // Check against block list
    const normalizedInputName = normalizeName(extractedName);
    console.log(`🔍 Normalized input: "${normalizedInputName}"`);
    
    const query = `
      SELECT id, name, severity, reason 
      FROM block_list 
      WHERE is_active = true
    `;
    
    const result = await client.query(query);
    const blockList = result.rows;
    
    console.log(`📋 Checking against ${blockList.length} block list entries...`);
    
    for (const entry of blockList) {
      const normalizedBlockName = normalizeName(entry.name);
      console.log(`  - Checking "${normalizedBlockName}" against "${normalizedInputName}"`);
      
      // Exact match
      if (normalizedInputName === normalizedBlockName) {
        console.log(`🚨 EXACT MATCH FOUND: ${entry.name} (${entry.severity})`);
        console.log(`   Reason: ${entry.reason}`);
        return;
      }
      
      // Partial match for multi-word names
      if (normalizedInputName.includes(normalizedBlockName) || normalizedBlockName.includes(normalizedInputName)) {
        console.log(`⚠️  PARTIAL MATCH FOUND: ${entry.name} (${entry.severity})`);
        console.log(`   Reason: ${entry.reason}`);
        return;
      }
    }
    
    console.log('✅ No matches found - payment would be allowed');
    
  } catch (error) {
    console.error('❌ Error testing fraud detection:', error.message);
  } finally {
    client.release();
  }
}

testFraudDetection()
  .then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });

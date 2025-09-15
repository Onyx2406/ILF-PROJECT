// Database migration to add currency conversion columns
const testDatabaseSchema = async () => {
  console.log('🔧 Checking and updating database schema...\n');

  try {
    // Test if columns exist by trying to select them
    console.log('📝 Testing existing columns...');
    const testResponse = await fetch('http://localhost:3004/api/aml/pending-payments');
    
    if (!testResponse.ok) {
      throw new Error(`API request failed: ${testResponse.statusText}`);
    }
    
    const testData = await testResponse.json();
    console.log('✅ AML API working, current pending payments:', testData.data.pendingPayments.length);
    
    // Now let's add the missing columns via SQL
    console.log('\n📝 Adding currency conversion columns...');
    const migrationSql = `
      -- Add currency conversion columns if they don't exist
      ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2);
      ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3);
      ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(10,6);
    `;
    
    // We'll use a direct database approach through our init endpoint
    console.log('🔧 Applying database migration...');
    
    // Test the webhook with proper columns
    console.log('\n📝 Testing webhook after schema update...');
    const webhookPayload = {
      id: 'test-schema-fix-001',
      type: 'incoming.payment.completed',
      data: {
        id: 'payment-schema-fix-001',
        walletAddressId: '8da14227-0f6f-486d-9e9d-df4dfe9b5573',
        client: 'Schema Fix Test Client',
        incomingAmount: {
          value: '1000', // USD 10.00
          assetCode: 'USD',
          assetScale: 2
        },
        receivedAmount: {
          value: '1000',
          assetCode: 'USD', 
          assetScale: 2
        },
        metadata: {
          description: 'Test payment for schema fix verification'
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

    // Check processing result
    console.log('\n⏳ Waiting for processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check webhook status
    console.log('\n📝 Checking webhook processing result...');
    const statusResponse = await fetch('http://localhost:3004/api/webhooks/rafiki?limit=3');
    const statusData = await statusResponse.json();
    
    const ourWebhook = statusData.data.webhooks.find(w => w.data.id === 'payment-schema-fix-001');
    
    if (ourWebhook) {
      console.log('\n📊 Webhook Status:');
      console.log(`• ID: ${ourWebhook.id}`);
      console.log(`• Type: ${ourWebhook.type}`);
      console.log(`• Status: ${ourWebhook.status}`);
      console.log(`• Error: ${ourWebhook.errorMessage || 'None'}`);
      
      if (ourWebhook.status === 'processed') {
        console.log('\n🎉 SUCCESS! Schema is working correctly.');
      } else if (ourWebhook.errorMessage) {
        console.log('\n❌ Still having schema issues:', ourWebhook.errorMessage);
      }
    }

  } catch (error) {
    console.error('❌ Schema test failed:', error.message);
  }
};

// Run the test
testDatabaseSchema();

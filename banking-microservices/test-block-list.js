async function testBlockListAPI() {
  console.log('🧪 Testing complete block list functionality...');
  
  try {
    // Test 1: Check if block list API works
    const response = await fetch('http://localhost:3200/api/aiml/block-list');
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Block list API working - Found', result.total, 'blocked entities');
    } else {
      console.log('❌ Block list API failed:', result.error);
      return;
    }

    // Test 2: Test different names
    const testNames = [
      'Usama Bin Laden',
      'Osama Bin Laden', 
      'Al-Qaeda',
      'Taliban',
      'John Smith', // Should NOT be blocked
      'usama bin laden', // Test case sensitivity
      'TALIBAN' // Test case sensitivity
    ];
    
    console.log('\n🧪 Testing block list checking for various names...');
    
    for (const name of testNames) {
      const checkResponse = await fetch('http://localhost:3200/api/test-block-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderName: name })
      });
      
      const checkResult = await checkResponse.json();
      const status = checkResult.isBlocked ? '🚫 BLOCKED' : '✅ ALLOWED';
      console.log(`${status}: "${name}" - ${checkResult.isBlocked ? checkResult.blockReason : 'Not in block list'}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing block list:', error.message);
  }
}

// Run the test
testBlockListAPI();
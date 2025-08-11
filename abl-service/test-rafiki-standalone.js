const axios = require('axios');
const { createHmac } = require('crypto');
const { canonicalize } = require('json-canonicalize');

// Rafiki GraphQL configuration - Happy Life Bank
const RAFIKI_CONFIG = {
  graphqlHost: 'http://localhost:4001',
  graphqlUrl: 'http://localhost:4001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d',
  assetId: 'b64f99cd-8b61-4c7f-9d73-cdd087e3d0ae', // USD asset ID from Happy Life Bank
  baseWalletUrl: 'https://abl-backend'
};

function generateBackendApiSignature(body) {
  const version = RAFIKI_CONFIG.backendApiSignatureVersion;
  const secret = RAFIKI_CONFIG.backendApiSignatureSecret;
  const timestamp = Date.now();
  const payload = `${timestamp}.${canonicalize(body)}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  
  return `t=${timestamp}, v${version}=${digest}`;
}

async function testRafikiConnection() {
  console.log('🧪 Testing Rafiki GraphQL connection...');
  
  const testAccount = {
    id: Math.floor(Math.random() * 10000), // Random ID to avoid duplicates
    name: "Test Account",
    email: "test@example.com",
    iban: "PK88ABBL4605492284238560"
  };

  const randomId = Math.random().toString(36).substring(2, 10); // Random ID
  const walletAddress = `https://abl-backend/accounts/acc${testAccount.id}`;
  
  const createWalletAddressQuery = `
    mutation CreateWalletAddress($input: CreateWalletAddressInput!) {
      createWalletAddress(input: $input) {
        walletAddress {
          id
          createdAt
          publicName
          address
          status
          asset {
            code
            createdAt
            id
            scale
            withdrawalThreshold
          }
        }
      }
    }
  `;

  const variables = {
    input: {
      assetId: RAFIKI_CONFIG.assetId,
      address: walletAddress,
      publicName: testAccount.name,
      additionalProperties: [
        {
          key: "iban", 
          value: testAccount.iban, 
          visibleInOpenPayments: true
        },
        {
          key: "email", 
          value: testAccount.email, 
          visibleInOpenPayments: false
        }
      ]
    }
  };

  const requestBody = {
    query: createWalletAddressQuery,
    variables: variables
  };

  const signature = generateBackendApiSignature(requestBody);
  
  console.log('📋 Request details:');
  console.log('- URL:', RAFIKI_CONFIG.graphqlUrl);
  console.log('- Signature:', signature.substring(0, 50) + '...');
  console.log('- Tenant ID:', RAFIKI_CONFIG.senderTenantId);
  console.log('- Asset ID:', RAFIKI_CONFIG.assetId);
  console.log('- Wallet Address:', walletAddress);
  
  try {
    console.log('🌐 Sending request to Rafiki...');
    const response = await axios.post(RAFIKI_CONFIG.graphqlUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'signature': signature,
        'tenant-id': RAFIKI_CONFIG.senderTenantId
      },
      timeout: 10000
    });

    console.log('✅ Response received!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    if (response.data.errors) {
      console.error('❌ GraphQL Errors:', response.data.errors);
    } else if (response.data.data?.createWalletAddress?.walletAddress) {
      const wallet = response.data.data.createWalletAddress.walletAddress;
      console.log('🎉 Wallet created successfully!');
      console.log('- ID:', wallet.id);
      console.log('- Address:', wallet.address);
      console.log('- Public Name:', wallet.publicName);
      console.log('- Status:', wallet.status);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Tip: Make sure Rafiki is running on localhost:3001');
    }
  }
}

testRafikiConnection();

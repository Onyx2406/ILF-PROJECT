const axios = require('axios');
const { createHmac } = require('crypto');
const { canonicalize } = require('json-canonicalize');

// Rafiki GraphQL configuration
const RAFIKI_CONFIG = {
  graphqlUrl: 'http://localhost:3001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: '438fa74a-fa7d-4317-9ced-dde32ece1787'
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

async function queryExistingWallets() {
  console.log('🔍 Querying existing wallet addresses...');
  
  const getWalletAddressesQuery = `
    query GetWalletAddresses {
      walletAddresses {
        edges {
          cursor
          node {
            id
            publicName
            address
            status
          }
        }
      }
    }
  `;

  const requestBody = {
    query: getWalletAddressesQuery
  };

  const signature = generateBackendApiSignature(requestBody);
  
  try {
    const response = await axios.post(RAFIKI_CONFIG.graphqlUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'signature': signature,
        'tenant-id': RAFIKI_CONFIG.senderTenantId
      },
      timeout: 10000
    });

    console.log('✅ Response received!');
    
    if (response.data.errors) {
      console.error('❌ GraphQL Errors:', response.data.errors);
    } else if (response.data.data?.walletAddresses?.edges) {
      const wallets = response.data.data.walletAddresses.edges;
      console.log(`🎉 Found ${wallets.length} existing wallet addresses:`);
      
      wallets.forEach((edge, index) => {
        const wallet = edge.node;
        console.log(`${index + 1}. ${wallet.publicName}`);
        console.log(`   - ID: ${wallet.id}`);
        console.log(`   - Address: ${wallet.address}`);
        console.log(`   - Status: ${wallet.status}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

queryExistingWallets();

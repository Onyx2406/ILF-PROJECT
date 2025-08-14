const axios = require('axios');
const { createHmac } = require('crypto');
const { canonicalize } = require('json-canonicalize');

// Rafiki GraphQL configuration - Happy Life Bank
const RAFIKI_CONFIG = {
  graphqlUrl: 'http://localhost:4001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d'
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

async function queryAssets() {
  console.log('🔍 Querying available assets...');
  
  const getAssetsQuery = `
    query GetAssets {
      assets {
        edges {
          cursor
          node {
            id
            code
            scale
            withdrawalThreshold
            createdAt
          }
        }
      }
    }
  `;

  const requestBody = {
    query: getAssetsQuery
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
    } else if (response.data.data?.assets?.edges) {
      const assets = response.data.data.assets.edges;
      console.log(`🎉 Found ${assets.length} available assets:`);
      
      assets.forEach((edge, index) => {
        const asset = edge.node;
        console.log(`${index + 1}. ${asset.code}`);
        console.log(`   - ID: ${asset.id}`);
        console.log(`   - Scale: ${asset.scale}`);
        console.log(`   - Withdrawal Threshold: ${asset.withdrawalThreshold}`);
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

queryAssets();

#!/usr/bin/env node

const axios = require('axios');
const { createHmac } = require('crypto');
const { canonicalize } = require('json-canonicalize');

// Cloud Nine Rafiki configuration
const CLOUD_NINE_CONFIG = {
  graphqlUrl: 'http://localhost:3001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: '438fa74a-fa7d-4317-9ced-dde32ece1787'
};

function generateBackendApiSignature(body) {
  const version = CLOUD_NINE_CONFIG.backendApiSignatureVersion;
  const secret = CLOUD_NINE_CONFIG.backendApiSignatureSecret;
  const timestamp = Date.now();
  const payload = `${timestamp}.${canonicalize(body)}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  
  return `t=${timestamp}, v${version}=${digest}`;
}

async function queryCloudNineWallets() {
  console.log('🔍 Querying Cloud Nine wallet addresses...');
  
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
    const response = await axios.post(CLOUD_NINE_CONFIG.graphqlUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'signature': signature,
        'tenant-id': CLOUD_NINE_CONFIG.senderTenantId
      },
      timeout: 10000
    });

    console.log('✅ Response received from Cloud Nine!');
    
    if (response.data.errors) {
      console.error('❌ GraphQL Errors:', response.data.errors);
    } else if (response.data.data?.walletAddresses?.edges) {
      const wallets = response.data.data.walletAddresses.edges.map(edge => edge.node);
      console.log('📋 Cloud Nine Wallet Addresses:');
      wallets.forEach((wallet, index) => {
        console.log(`  ${index + 1}. ID: ${wallet.id}`);
        console.log(`     Address: ${wallet.address}`);
        console.log(`     Public Name: ${wallet.publicName}`);
        console.log(`     Status: ${wallet.status}`);
        console.log('');
        
        // Check if this is the gfranklin wallet
        if (wallet.address.includes('gfranklin')) {
          console.log(`🎯 Found gfranklin wallet: ${wallet.id}`);
        }
      });
      
      // Look for any wallet that could be used for gfranklin account
      const gfranklinWallet = wallets.find(w => 
        w.address.includes('gfranklin') || w.publicName?.includes('gfranklin')
      );
      
      if (gfranklinWallet) {
        console.log('✅ Found gfranklin wallet ID:', gfranklinWallet.id);
        return gfranklinWallet.id;
      } else {
        console.log('⚠️ No gfranklin wallet found. Available wallets:');
        wallets.forEach(wallet => {
          console.log(`   - ${wallet.address} (ID: ${wallet.id})`);
        });
        
        // Return the first active wallet as fallback
        const activeWallet = wallets.find(w => w.status === 'ACTIVE');
        if (activeWallet) {
          console.log('💡 Using first active wallet as fallback:', activeWallet.id);
          return activeWallet.id;
        }
      }
    } else {
      console.log('⚠️ No wallet addresses found in response');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error querying Cloud Nine wallets:', error.message);
    if (error.response) {
      console.error('📡 Response details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
  }
}

queryCloudNineWallets();

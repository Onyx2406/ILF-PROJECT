import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';

// Same values as Happy Life Bank configuration
const BACKEND_API_SIGNATURE_VERSION = 1;
const BACKEND_API_SIGNATURE_SECRET = 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=';
const SENDER_TENANT_ID = 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d'; // Happy Life Bank tenant ID
const GRAPHQL_ENDPOINT = 'http://localhost:4001/graphql'; // Happy Life Bank GraphQL endpoint

const CREATE_WALLET_ADDRESS = `
  mutation CreateWalletAddress($input: CreateWalletAddressInput!) {
    createWalletAddress(input: $input) {
      walletAddress {
        id
        createdAt
        address
        publicName
        status
        asset {
          code
          scale
          id
        }
        additionalProperties {
          key
          value
          visibleInOpenPayments
        }
      }
    }
  }
`;

function generateBackendApiSignature(body: Record<string, unknown>) {
  const timestamp = Date.now();
  const payload = `${timestamp}.${canonicalize(body)}`;
  const hmac = createHmac('sha256', BACKEND_API_SIGNATURE_SECRET);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  
  return `t=${timestamp}, v${BACKEND_API_SIGNATURE_VERSION}=${digest}`;
}

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();
    
    const requestBody = {
      query: CREATE_WALLET_ADDRESS.trim(),
      variables: { input }
    };
    
    const signature = generateBackendApiSignature(requestBody);
    
    console.log('🚀 SERVER: Creating wallet address in Happy Life Bank...');
    console.log('📋 SERVER: Input:', JSON.stringify(input, null, 2));
    console.log('🔑 SERVER: Signature:', signature);
    console.log('🏢 SERVER: Happy Life Bank Tenant ID:', SENDER_TENANT_ID);
    
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'signature': signature,
        'tenant-id': SENDER_TENANT_ID
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📊 SERVER: Response status:', response.status);
    const result = await response.json();
    console.log('📦 SERVER: Response:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data.createWalletAddress) {
      const walletData = result.data.createWalletAddress.walletAddress;
      console.log('✅ SERVER: SUCCESS! Created wallet address in Happy Life Bank:');
      console.log(`💰 SERVER: - Address: ${walletData.address}`);
      console.log(`👤 SERVER: - Name: ${walletData.publicName}`);
      console.log(`💱 SERVER: - Currency: ${walletData.asset.code}`);
      console.log(`🆔 SERVER: - ID: ${walletData.id}`);
      
      return NextResponse.json({
        success: true,
        walletAddress: walletData
      });
    } else {
      console.log('❌ SERVER: Failed to create wallet address');
      console.log('📦 SERVER: Error response:', JSON.stringify(result, null, 2));
      return NextResponse.json({
        success: false,
        error: result.errors?.[0]?.message || 'Failed to create wallet address'
      }, { status: 400 });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('💥 SERVER: Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

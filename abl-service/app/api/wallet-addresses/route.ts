import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';

// Same values as Happy Life Bank configuration
const BACKEND_API_SIGNATURE_VERSION = 1;
const BACKEND_API_SIGNATURE_SECRET = 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=';
const SENDER_TENANT_ID = 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d';

// Use the working endpoint from your logs
const GRAPHQL_ENDPOINT = 'http://172.17.0.1:4001/graphql';

// Correct mutation with required address field
const CREATE_WALLET_ADDRESS_MUTATION = `
  mutation CreateWalletAddress($input: CreateWalletAddressInput!) {
    createWalletAddress(input: $input) {
      walletAddress {
        id
        publicName
        asset {
          id
          code
          scale
        }
        additionalProperties {
          key
          value
          visibleInOpenPayments
        }
        createdAt
      }
    }
  }
`;

function generateBackendApiSignature(body: any) {
  const timestamp = Date.now();
  const payload = `${timestamp}.${canonicalize(body)}`;
  const hmac = createHmac('sha256', BACKEND_API_SIGNATURE_SECRET);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  
  return `t=${timestamp}, v${BACKEND_API_SIGNATURE_VERSION}=${digest}`;
}

export async function POST(request: NextRequest) {
  try {
    const { assetId, publicName, accountIban } = await request.json();

    console.log('🚀 Creating wallet address with:', { assetId, publicName, accountIban });

    if (!assetId || !publicName) {
      return NextResponse.json({
        success: false,
        error: { message: 'Asset ID and public name are required' }
      }, { status: 400 });
    }

    // Generate the wallet address in the required format
    const walletAddress = accountIban ? 
      `https://abl-backend/${accountIban}` : 
      `https://abl-backend/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log('🔗 Generated wallet address:', walletAddress);

    const requestBody = {
      query: CREATE_WALLET_ADDRESS_MUTATION,
      variables: {
        input: {
          assetId: assetId,
          address: walletAddress, // Required field
          publicName: publicName,
          additionalProperties: [
            {
              key: "mobile",
              value: "+31121212",
              visibleInOpenPayments: false
            },
            {
              key: "iban",
              value: accountIban || `PK${Math.floor(Math.random() * 100)}ABBL${Math.floor(Math.random() * 1000000000000000)}`,
              visibleInOpenPayments: true
            }
          ]
        }
      }
    };

    const signature = generateBackendApiSignature(requestBody);

    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));
    console.log('🔑 Signature:', signature);
    console.log('🔍 Using working endpoint:', GRAPHQL_ENDPOINT);

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'signature': signature,
        'tenant-id': SENDER_TENANT_ID,
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    console.log('📊 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP Error:', response.status, errorText);
      return NextResponse.json({
        success: false,
        error: { message: `HTTP ${response.status}: ${errorText}` }
      }, { status: response.status });
    }

    const result = await response.json();
    console.log('📦 Response from Rafiki:', JSON.stringify(result, null, 2));

    if (result.errors) {
      console.error('❌ GraphQL Errors:', result.errors);
      return NextResponse.json({
        success: false,
        error: { message: `GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}` }
      }, { status: 400 });
    }

    const walletAddressResult = result.data?.createWalletAddress;
    
    if (!walletAddressResult?.walletAddress) {
      console.error('❌ No wallet address in response');
      return NextResponse.json({
        success: false,
        error: { message: 'No wallet address returned from Rafiki' }
      }, { status: 400 });
    }

    const createdWalletAddress = walletAddressResult.walletAddress;
    console.log('✅ Real wallet address created successfully:', createdWalletAddress);

    return NextResponse.json({
      success: true,
      data: {
        id: createdWalletAddress.id,
        url: walletAddress, // Use the address we sent
        publicName: createdWalletAddress.publicName,
        asset: createdWalletAddress.asset,
        additionalProperties: createdWalletAddress.additionalProperties,
        createdAt: createdWalletAddress.createdAt,
        status: 'ACTIVE'
      },
      source: 'rafiki-real'
    });

  } catch (error) {
    console.error('❌ Error creating wallet address:', error);
    return NextResponse.json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Internal server error' }
    }, { status: 500 });
  }
}

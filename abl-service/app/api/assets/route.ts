import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';

// Same values as Happy Life Bank configuration
const BACKEND_API_SIGNATURE_VERSION = 1;
const BACKEND_API_SIGNATURE_SECRET = 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=';
const SENDER_TENANT_ID = 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d'; // Happy Life Bank tenant ID

// Try multiple endpoints - Docker containers can't always reach localhost
const POSSIBLE_ENDPOINTS = [
  'http://host.docker.internal:4001/graphql',  // Docker Desktop
  'http://172.17.0.1:4001/graphql',           // Docker bridge network
  'http://localhost:4001/graphql',            // Direct localhost
  'http://127.0.0.1:4001/graphql',           // Direct IP
  'http://rafiki-auth:4001/graphql',         // Docker service name
  'http://happy-life-bank:4001/graphql',     // Alternative service name
];

const GET_ASSETS = `
  query GetAssets($after: String, $before: String, $first: Int, $last: Int) {
    assets(after: $after, before: $before, first: $first, last: $last) {
      edges {
        cursor
        node {
          code
          createdAt
          id
          scale
          withdrawalThreshold
          liquidityThreshold
          liquidity
          sendingFee {
            id
            type
            basisPoints
            fixed
          }
          receivingFee {
            id
            type
            basisPoints
            fixed
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
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

export async function GET() {
  const requestBody = {
    query: GET_ASSETS.trim(),
    variables: { first: 50 }
  };
  
  const signature = generateBackendApiSignature(requestBody);
  
  console.log('🚀 SERVER: Testing Happy Life Bank authentication...');
  console.log('📋 SERVER: Request body:', JSON.stringify(requestBody, null, 2));
  console.log('🔑 SERVER: Signature:', signature);
  console.log('🏢 SERVER: Happy Life Bank Tenant ID:', SENDER_TENANT_ID);
  
  // Try each endpoint until one works
  for (const GRAPHQL_ENDPOINT of POSSIBLE_ENDPOINTS) {
    console.log(`🔍 SERVER: Trying endpoint: ${GRAPHQL_ENDPOINT}`);
    
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'signature': signature,
          'tenant-id': SENDER_TENANT_ID
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      console.log(`📊 SERVER: Response status from ${GRAPHQL_ENDPOINT}:`, response.status);
      
      // Check if response is ok first
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ SERVER: HTTP Error from ${GRAPHQL_ENDPOINT}:`, response.status, errorText);
        continue; // Try next endpoint
      }
      
      const result = await response.json();
      console.log('📦 SERVER: Response:', JSON.stringify(result, null, 2));
      
      // Check for GraphQL errors
      if (result.errors) {
        console.error(`❌ SERVER: GraphQL Errors from ${GRAPHQL_ENDPOINT}:`, result.errors);
        continue; // Try next endpoint
      }
      
      if (result.data && result.data.assets && result.data.assets.edges) {
        console.log(`✅ SERVER: SUCCESS! Found ${result.data.assets.edges.length} Happy Life Bank assets from ${GRAPHQL_ENDPOINT}`);
        result.data.assets.edges.forEach((edge: any) => {
          console.log(`💰 SERVER: - ${edge.node.code} (${edge.node.id}) - Happy Life Bank`);
        });
        
        // Return the assets for the frontend - Fixed response format
        return NextResponse.json({
          success: true,
          data: result.data.assets.edges.map((edge: any) => edge.node),
          pageInfo: result.data.assets.pageInfo,
          source: 'happy-life-bank',
          endpoint: GRAPHQL_ENDPOINT
        });
      } else {
        console.log(`❌ SERVER: No assets found in response from ${GRAPHQL_ENDPOINT}`);
        continue; // Try next endpoint
      }
      
    } catch (error: any) {
      console.error(`💥 SERVER: Error connecting to ${GRAPHQL_ENDPOINT}:`, error.message);
      continue; // Try next endpoint
    }
  }
  
  // If we get here, all endpoints failed
  console.error('💥 SERVER: All Happy Life Bank endpoints failed');
  return NextResponse.json({
    success: false,
    error: 'All Happy Life Bank endpoints failed - service may be down',
    testedEndpoints: POSSIBLE_ENDPOINTS
  }, { status: 500 });
}

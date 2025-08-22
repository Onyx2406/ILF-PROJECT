import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';

export async function GET(request: NextRequest) {
  try {
    const query = `
      query GetWalletAddresses {
        walletAddresses {
          edges {
            node {
              id
              publicName
            }
          }
        }
      }
    `;
    
    const body = { query };
    
    // Generate signature
    const secret = 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=';
    const version = '1';
    const timestamp = Date.now();
    
    const canonicalBody = canonicalize(body);
    const payload = `${timestamp}.${canonicalBody}`;
    
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const digest = hmac.digest('hex');
    
    const signature = `t=${timestamp}, v${version}=${digest}`;
    
    // Make the request to Rafiki
    const rafikiUrl = process.env.RAFIKI_GRAPHQL_URL || 'http://cloud-nine-backend:3001/graphql';
    
    const rafikiResponse = await fetch(rafikiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'tenant-id': '438fa74a-fa7d-4317-9ced-dde32ece1787',
        'signature': signature,
      },
      body: JSON.stringify(body),
    });
    
    if (!rafikiResponse.ok) {
      const errorText = await rafikiResponse.text();
      console.error('Wallet addresses query error:', errorText);
      return NextResponse.json(
        { error: `Failed to get wallet addresses: ${rafikiResponse.status}` },
        { status: rafikiResponse.status }
      );
    }
    
    const responseData = await rafikiResponse.json();
    console.log('Wallet addresses response:', JSON.stringify(responseData, null, 2));
    
    // Find Grace Franklin's wallet address ID
    const walletAddresses = responseData.data?.walletAddresses?.edges?.map((edge: any) => edge.node) || [];
    const graceFranklin = walletAddresses.find((wa: any) => wa.publicName === 'Grace Franklin');
    
    return NextResponse.json({
      walletAddresses,
      graceFranklinId: graceFranklin?.id || null,
      graceFranklin
    });
  } catch (error: any) {
    console.error('Wallet addresses API error:', error);
    return NextResponse.json(
      { error: 'Failed to get wallet addresses', details: error.message },
      { status: 500 }
    );
  }
}

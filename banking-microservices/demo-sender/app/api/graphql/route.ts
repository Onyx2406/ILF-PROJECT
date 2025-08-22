import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('GraphQL API - Original body:', JSON.stringify(body, null, 2));
    
    // Format the body exactly like Bruno does
    const { variables } = body;
    const formattedBody = {
      ...body,
      variables: typeof variables === 'string' ? JSON.parse(variables) : variables
    };
    
    console.log('GraphQL API - Formatted body:', JSON.stringify(formattedBody, null, 2));
    
    // Generate signature
    const secret = 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=';
    const version = '1';
    const timestamp = Date.now();
    
    const canonicalBody = canonicalize(formattedBody);
    console.log('GraphQL API - Canonical body:', canonicalBody);
    
    const payload = `${timestamp}.${canonicalBody}`;
    console.log('GraphQL API - Signing payload:', payload);
    
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const digest = hmac.digest('hex');
    
    const signature = `t=${timestamp}, v${version}=${digest}`;
    console.log('GraphQL API - Generated signature:', signature);
    
    // Make the actual GraphQL request to Rafiki
    const rafikiUrl = process.env.RAFIKI_GRAPHQL_URL || 'http://cloud-nine-backend:3001/graphql';
    console.log('GraphQL API - Making request to:', rafikiUrl);
    
    const rafikiResponse = await fetch(rafikiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'tenant-id': '438fa74a-fa7d-4317-9ced-dde32ece1787',
        'signature': signature,
      },
      body: JSON.stringify(formattedBody),
    });
    
    console.log('GraphQL API - Rafiki response status:', rafikiResponse.status);
    
    if (!rafikiResponse.ok) {
      const errorText = await rafikiResponse.text();
      console.error('GraphQL API - Rafiki error:', errorText);
      return NextResponse.json(
        { error: `Rafiki request failed: ${rafikiResponse.status} - ${errorText}` },
        { status: rafikiResponse.status }
      );
    }
    
    const responseData = await rafikiResponse.json();
    console.log('GraphQL API - Rafiki response:', JSON.stringify(responseData, null, 2));
    
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('GraphQL API - Error:', error);
    return NextResponse.json(
      { error: 'GraphQL request failed', details: error.message },
      { status: 500 }
    );
  }
}

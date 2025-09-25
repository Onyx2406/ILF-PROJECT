import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Original body:', JSON.stringify(body, null, 2));
    
    // Format the body exactly like Bruno does
    const { variables } = body;
    const formattedBody = {
      ...body,
      variables: typeof variables === 'string' ? JSON.parse(variables) : variables
    };
    
    console.log('Formatted body:', JSON.stringify(formattedBody, null, 2));
    
    const secret = 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=';
    const version = '1';
    const timestamp = Date.now();
    
    const canonicalBody = canonicalize(formattedBody);
    console.log('Canonical body:', canonicalBody);
    
    const payload = `${timestamp}.${canonicalBody}`;
    console.log('Signing payload:', payload);
    
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const digest = hmac.digest('hex');
    
    // Bruno format: "t=${timestamp}, v${version}=${digest}" (note the space after comma)
    const signature = `t=${timestamp}, v${version}=${digest}`;
    console.log('Generated signature:', signature);
    
    return NextResponse.json({
      signature,
      tenantId: '438fa74a-fa7d-4317-9ced-dde32ece1787'
    });
  } catch (error) {
    console.error('Signing error:', error);
    return NextResponse.json({ error: 'Signing failed' }, { status: 500 });
  }
}

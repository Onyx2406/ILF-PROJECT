import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://abl-backend:8101';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log(`🔄 Proxying transfer request to backend...`);
    console.log('📋 Transfer data:', body);
    
    const response = await fetch(`${BACKEND_URL}/api/accounts/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('❌ Backend transfer error:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    console.log(`✅ Transfer successful: ${data.data?.amount} from account ${data.data?.from_account?.id} to ${data.data?.to_account?.id}`);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error processing transfer:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to process transfer' }
    }, { status: 500 });
  }
}
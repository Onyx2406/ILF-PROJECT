import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://abl-backend:8101';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log(`💰 Proxying credit request for account ${id} to backend...`);
    console.log('📋 Credit data:', body);
    
    const response = await fetch(`${BACKEND_URL}/api/accounts/${id}/credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('❌ Backend credit error:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    console.log(`✅ Credit successful: ${data.data?.transaction?.amount} credited to account ${id}`);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error processing credit:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to process credit' }
    }, { status: 500 });
  }
}
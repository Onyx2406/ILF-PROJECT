import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://abl-backend:8101';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    console.log(`📊 Proxying transactions request for account ${id} to backend...`);
    
    // Forward query parameters
    const queryString = searchParams.toString();
    const url = `${BACKEND_URL}/api/accounts/${id}/transactions${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Backend transactions error:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    console.log(`✅ Retrieved ${data.data?.length || 0} transactions for account ${id}`);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to fetch transactions' }
    }, { status: 500 });
  }
}r
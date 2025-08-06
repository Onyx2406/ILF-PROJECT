import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://abl-backend:8101';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🔗 Proxying payment pointer request for ID ${id} to backend...`);
    
    const response = await fetch(`${BACKEND_URL}/api/payment-pointers/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Backend responded with:', response.status, response.statusText);
      return NextResponse.json({
        success: false,
        error: { message: `Backend error: ${response.status}` }
      }, { status: response.status });
    }

    const data = await response.json();
    console.log(`✅ Found payment pointer for account: ${data.data?.name}`);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error fetching payment pointer:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to fetch payment pointer' }
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🗑️ Proxying delete payment pointer request for ID ${id} to backend...`);
    
    const response = await fetch(`${BACKEND_URL}/api/payment-pointers/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Backend responded with:', response.status, response.statusText);
      return NextResponse.json({
        success: false,
        error: { message: `Backend error: ${response.status}` }
      }, { status: response.status });
    }

    const data = await response.json();
    console.log(`✅ Removed payment pointer for account: ${data.data?.name}`);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error removing payment pointer:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to remove payment pointer' }
    }, { status: 500 });
  }
}
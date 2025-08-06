import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://abl-backend:8101';

export async function GET() {
  try {
    console.log('🔗 Proxying payment pointers request to backend...');
    
    const response = await fetch(`${BACKEND_URL}/api/payment-pointers`, {
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
    console.log(`✅ Found ${data.count || 0} payment pointers`);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error fetching payment pointers:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to fetch payment pointers' }
    }, { status: 500 });
  }
}
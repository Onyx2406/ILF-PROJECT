import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://abl-backend:8101';

// GET - Get customer's accounts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const response = await fetch(`${BACKEND_URL}/api/customers/${id}/accounts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });

  } catch (error) {
    console.error('Error fetching customer accounts:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch customer accounts' } },
      { status: 500 }
    );
  }
}

// POST - Create account for customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log(`🏦 Creating account for customer ${id}:`, body);
    
    const response = await fetch(`${BACKEND_URL}/api/customers/${id}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });

  } catch (error) {
    console.error('Error creating customer account:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create customer account' } },
      { status: 500 }
    );
  }
}
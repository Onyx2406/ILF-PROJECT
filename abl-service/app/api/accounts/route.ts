import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://abl-backend:8101';

// CREATE - Create new account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });

  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create account' } },
      { status: 500 }
    );
  }
}

// READ - Get all accounts
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/accounts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });

  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch accounts' } },
      { status: 500 }
    );
  }
}

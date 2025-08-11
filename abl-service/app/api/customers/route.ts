import { NextRequest, NextResponse } from 'next/server';

// Use different URLs for Docker vs local development
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'http://abl-backend:8101'  // Docker internal networking
  : process.env.BACKEND_URL || 'http://localhost:8101'; // Local development

console.log('🔗 Backend URL:', BACKEND_URL);

// GET - Get all customers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = `${BACKEND_URL}/api/customers${queryString ? `?${queryString}` : ''}`;
    
    console.log('🔗 Calling backend:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });

  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch customers' } },
      { status: 500 }
    );
  }
}

// POST - Create new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('👤 Creating new customer via API:', body);
    console.log('🔗 Backend URL:', `${BACKEND_URL}/api/customers`);
    
    const response = await fetch(`${BACKEND_URL}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    console.log('📨 Backend response:', result);
    
    return NextResponse.json(result, { status: response.status });

  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create customer' } },
      { status: 500 }
    );
  }
}
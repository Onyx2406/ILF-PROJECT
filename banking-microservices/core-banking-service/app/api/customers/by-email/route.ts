import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

// POST - Get customer by email
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: { message: 'Email is required' } },
        { status: 400 }
      );
    }

    console.log(`🔍 Looking up customer by email: ${email}`);

    const db = getDatabase();
    
    const result = await db.query(
      'SELECT * FROM customers WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ No customer found with email: ${email}`);
      return NextResponse.json(
        { success: false, error: { message: 'Customer not found' } },
        { status: 404 }
      );
    }

    const customer = result.rows[0];
    console.log(`✅ Found customer: ${customer.name} (ID: ${customer.c_id})`);

    return NextResponse.json({
      success: true,
      data: customer
    });

  } catch (error: any) {
    console.error('Error fetching customer by email:', error);
    
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch customer' } },
      { status: 500 }
    );
  }
}

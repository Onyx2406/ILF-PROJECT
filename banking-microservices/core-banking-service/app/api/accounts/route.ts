import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { generateIBAN } from '@/lib/rafiki';
import { ensureDatabaseInitialized } from '@/lib/init';

// CREATE - Create new account
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    
    const body = await request.json();
    const { name, email } = body;
    
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: { message: 'Name and email are required' } },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const iban = generateIBAN();
    
    const result = await db.query(
      `INSERT INTO accounts (name, email, iban, currency, balance, available_balance, book_balance) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, email, iban, 'PKR', '0.00', '0.00', '0.00'] // Initialize all balance fields to 0
    );

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error creating account:', error);
    
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: { message: 'Email already exists' } },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create account' } },
      { status: 500 }
    );
  }
}

// READ - Get all accounts
export async function GET() {
  try {
    await ensureDatabaseInitialized();
    
    const db = getDatabase();
    
    const result = await db.query(`
      SELECT 
        id,
        name,
        email,
        iban,
        currency,
        balance,
        available_balance,
        book_balance,
        status,
        wallet_address,
        wallet_id,
        asset_id,
        created_at,
        updated_at
      FROM accounts 
      ORDER BY created_at DESC
    `);

    console.log('Returning accounts from Next.js API route');
    return NextResponse.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch accounts' } },
      { status: 500 }
    );
  }
}

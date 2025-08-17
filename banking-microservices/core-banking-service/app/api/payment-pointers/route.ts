import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

// GET - Get all accounts with wallet addresses (payment pointers)
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
        status,
        wallet_address,
        wallet_id,
        wallet_public_name,
        asset_id,
        created_at,
        updated_at
      FROM accounts 
      WHERE wallet_address IS NOT NULL
      ORDER BY created_at DESC
    `);

    console.log('Payment pointers fetched:', result.rows.length);
    return NextResponse.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Error fetching payment pointers:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch payment pointers' } },
      { status: 500 }
    );
  }
}

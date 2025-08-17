import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { createWalletAddressInRafiki, RAFIKI_CONFIG } from '@/lib/rafiki';
import { ensureDatabaseInitialized } from '@/lib/init';

// CREATE - Create wallet address
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    
    const body = await request.json();
    const { accountId } = body;
    
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: { message: 'Account ID is required' } },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // First, get the account details
    const accountResult = await db.query(
      'SELECT * FROM accounts WHERE id = $1',
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Account not found' } },
        { status: 404 }
      );
    }

    const account = accountResult.rows[0];

    // Check if wallet address already exists
    if (account.wallet_address) {
      return NextResponse.json(
        { success: false, error: { message: 'Wallet address already exists for this account' } },
        { status: 400 }
      );
    }

    console.log('🚀 Creating wallet address for account:', account);

    // Create wallet address in Rafiki
    const walletAddress = await createWalletAddressInRafiki(account);
    
    console.log('✅ Wallet address created:', walletAddress);

    // Update account with wallet information
    const updateResult = await db.query(
      `UPDATE accounts 
       SET wallet_address = $1, 
           wallet_id = $2, 
           asset_id = $3,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [
        walletAddress.address,
        walletAddress.id,
        walletAddress.asset.id,
        accountId
      ]
    );

    const updatedAccount = updateResult.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        account: updatedAccount,
        walletAddress: walletAddress,
        message: 'Wallet address created successfully'
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error creating wallet address:', error);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to create wallet address' } },
      { status: 500 }
    );
  }
}

// GET - Get all wallet addresses
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
        wallet_address,
        wallet_id,
        asset_id,
        created_at,
        updated_at
      FROM accounts 
      WHERE wallet_address IS NOT NULL
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ 
      success: true, 
      data: result.rows,
      message: `Found ${result.rows.length} accounts with wallet addresses`
    });

  } catch (error) {
    console.error('Error fetching wallet addresses:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch wallet addresses' } },
      { status: 500 }
    );
  }
}

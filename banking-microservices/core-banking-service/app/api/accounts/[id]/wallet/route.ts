import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

// CREATE - Create wallet address for specific account
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureDatabaseInitialized();
    
    const accountId = params.id;
    const body = await request.json();
    const { publicName } = body;
    
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
        { 
          success: true, 
          data: {
            account: account,
            walletAddress: account.wallet_address,
            message: 'Wallet address already exists for this account'
          }
        },
        { status: 200 }
      );
    }

    console.log('🚀 CBS: Creating wallet address for account:', account);
    console.log('📋 CBS: Requesting OC service to handle Rafiki communication...');

    // Step 2: Request OC service to create wallet in Rafiki
    const ocRafikiUrl = 'http://oc-service:3300/api/rafiki/wallet';
    const rafikiPayload = {
      id: account.id,
      name: account.name,
      iban: account.iban,
      email: account.email,
      publicName: publicName || account.name
    };

    console.log('🔗 CBS: Calling OC service for Rafiki wallet creation...');
    const rafikiResponse = await fetch(ocRafikiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-source-service': 'core-banking'
      },
      body: JSON.stringify(rafikiPayload)
    });

    if (!rafikiResponse.ok) {
      console.error(`❌ CBS: OC → Rafiki communication failed: ${rafikiResponse.status}`);
      const errorData = await rafikiResponse.json().catch(() => ({}));
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: errorData.error?.message || 'Failed to create wallet in Rafiki via OC service' 
          } 
        },
        { status: rafikiResponse.status }
      );
    }

    const rafikiData = await rafikiResponse.json();
    console.log('✅ CBS: Received wallet data from OC → Rafiki:', rafikiData);
    
    const walletAddress = rafikiData.data || rafikiData;

    // Format the wallet address as requested: https://abl-backend/iban
    const formattedWalletUrl = `https://abl-backend/${account.iban}`;

    // Step 3: Update account with wallet information
    console.log('📝 CBS: Updating database with wallet information...');
    const updateResult = await db.query(
      `UPDATE accounts 
       SET wallet_address = $1, 
           wallet_id = $2, 
           asset_id = $3,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [
        formattedWalletUrl, // Use the formatted URL as requested
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
        walletAddress: formattedWalletUrl,
        rafikiWalletAddress: walletAddress.address, // Keep original Rafiki address for reference
        rafiki_wallet: walletAddress, // Include full Rafiki wallet data
        message: 'Wallet address created successfully via CBS → OC → Rafiki flow'
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

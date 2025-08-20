import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, publicName } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔗 CREATING WALLET for account ID: ${accountId} via IB → CBS → OC → Rafiki flow`);

    // Step 1: Call CBS DIRECTLY (not through OC service)
    console.log(`📋 Step 1: Calling CBS directly...`);
    const cbsWalletUrl = `http://core-banking:3200/api/accounts/${accountId}/wallet`;
    
    const cbsPayload = publicName ? { publicName } : {};
    
    const cbsResponse = await fetch(cbsWalletUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cbsPayload)
    });

    if (!cbsResponse.ok) {
      console.error(`❌ CBS wallet creation failed: ${cbsResponse.status}`);
      const errorData = await cbsResponse.json().catch(() => ({}));
      return NextResponse.json(
        { 
          success: false,
          error: { 
            message: errorData.error?.message || 'Failed to create wallet address in CBS'
          }
        },
        { status: cbsResponse.status }
      );
    }

    const walletData = await cbsResponse.json();
    console.log(`✅ Wallet created successfully via IB → CBS → OC → Rafiki flow:`, walletData);

    return NextResponse.json(walletData);

  } catch (error) {
    console.error('❌ Error creating wallet address:', error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error' 
        }
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log(`📋 FETCHING ALL WALLETS`);

    // Call Core Banking service to get all wallet addresses
    const coreBankingUrl = `http://core-banking:3200/api/wallets`;
    console.log(`📡 Calling Core Banking: ${coreBankingUrl}`);

    const response = await fetch(coreBankingUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Core Banking API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch wallets from Core Banking' },
        { status: response.status }
      );
    }

    const walletsData = await response.json();
    console.log(`✅ Core Banking wallets response:`, walletsData);

    return NextResponse.json(walletsData);

  } catch (error) {
    console.error('❌ Error fetching wallets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

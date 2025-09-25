import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const accountId = searchParams.get('accountId'); // New parameter for account-level filtering

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    console.log(`🏦 FETCHING ACCOUNTS for customer ID: ${customerId}${accountId ? `, specific account ID: ${accountId}` : ''}`);

    // If accountId is provided, fetch only that specific account
    if (accountId) {
      const coreBankingUrl = `http://core-banking:3200/api/accounts/${accountId}`;
      console.log(`🎯 Calling Core Banking for specific account: ${coreBankingUrl}`);

      const response = await fetch(coreBankingUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`❌ Core Banking API error: ${response.status} ${response.statusText}`);
        return NextResponse.json(
          { error: 'Failed to fetch account from Core Banking' },
          { status: response.status }
        );
      }

      const accountData = await response.json();
      console.log(`✅ Core Banking response for account:`, accountData);

      // Return single account in array format to maintain compatibility
      return NextResponse.json({
        success: true,
        data: [accountData.data],
        count: 1
      });
    }

    // Otherwise, fetch all customer accounts (existing behavior)
    const coreBankingUrl = `http://core-banking:3200/api/customers/${customerId}/accounts`;
    console.log(`📋 Calling Core Banking for all accounts: ${coreBankingUrl}`);

    const response = await fetch(coreBankingUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Core Banking API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch accounts from Core Banking' },
        { status: response.status }
      );
    }

    const accountsData = await response.json();
    console.log(`✅ Core Banking response:`, accountsData);

    return NextResponse.json(accountsData);

  } catch (error) {
    console.error('❌ Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

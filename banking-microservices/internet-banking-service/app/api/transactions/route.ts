import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    console.log(`🏦 FETCHING TRANSACTIONS for account ID: ${accountId}`);

    // Call Core Banking Service to get transactions
    const coreBankingUrl = `http://core-banking:3200/api/accounts/${accountId}/transactions`;
    console.log(`📋 Calling Core Banking for transactions: ${coreBankingUrl}`);

    const response = await fetch(coreBankingUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Core Banking API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch transactions from Core Banking' },
        { status: response.status }
      );
    }

    const transactionsData = await response.json();
    console.log(`✅ Core Banking transactions response:`, transactionsData);

    // Transform the response to match our frontend expectations
    if (transactionsData.success && transactionsData.data && transactionsData.data.transactions) {
      return NextResponse.json({
        success: true,
        data: transactionsData.data.transactions, // Extract just the transactions array
        count: transactionsData.data.transactions.length
      });
    } else {
      // Handle case where no transactions exist
      return NextResponse.json({
        success: true,
        data: [],
        count: 0
      });
    }

  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

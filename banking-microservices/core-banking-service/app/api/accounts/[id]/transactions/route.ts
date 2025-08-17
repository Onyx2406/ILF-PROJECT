import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

// GET - Get account transactions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id: accountId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const db = getDatabase();
    
    // Check if account exists
    const accountCheck = await db.query(
      'SELECT id, name, iban, currency FROM accounts WHERE id = $1',
      [accountId]
    );

    if (accountCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: { message: 'Account not found' }
      }, { status: 404 });
    }

    const account = accountCheck.rows[0];

    // Get transactions with pagination
    const transactionsResult = await db.query(`
      SELECT 
        t.*,
        ra.name as related_account_name,
        ra.iban as related_account_iban
      FROM transactions t
      LEFT JOIN accounts ra ON t.related_account_id = ra.id
      WHERE t.account_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `, [accountId, limit, offset]);

    // Get total count for pagination
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM transactions WHERE account_id = $1',
      [accountId]
    );

    const totalTransactions = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalTransactions / limit);

    console.log(`✅ Found ${transactionsResult.rows.length} transactions for account ${accountId}`);

    return NextResponse.json({
      success: true,
      data: {
        account: account,
        transactions: transactionsResult.rows,
        pagination: {
          page,
          limit,
          total: totalTransactions,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching account transactions:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch transactions' } },
      { status: 500 }
    );
  }
}

// POST - Create a new transaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id: accountId } = await params;
    const body = await request.json();
    const {
      transaction_type,
      amount,
      description,
      related_account_id,
      reference_number
    } = body;

    const db = getDatabase();

    // Start transaction
    await db.query('BEGIN');

    try {
      // Get current account balance
      const accountResult = await db.query(
        'SELECT balance, currency FROM accounts WHERE id = $1',
        [accountId]
      );

      if (accountResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          error: { message: 'Account not found' }
        }, { status: 404 });
      }

      const currentBalance = parseFloat(accountResult.rows[0].balance);
      const currency = accountResult.rows[0].currency;
      const transactionAmount = parseFloat(amount);

      // Calculate new balance
      let newBalance;
      if (transaction_type === 'CREDIT') {
        newBalance = currentBalance + transactionAmount;
      } else if (transaction_type === 'DEBIT') {
        newBalance = currentBalance - transactionAmount;
        
        // Check for sufficient funds
        if (newBalance < 0) {
          await db.query('ROLLBACK');
          return NextResponse.json({
            success: false,
            error: { message: 'Insufficient funds' }
          }, { status: 400 });
        }
      } else {
        await db.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          error: { message: 'Invalid transaction type. Use CREDIT or DEBIT' }
        }, { status: 400 });
      }

      // Create transaction record
      const transactionResult = await db.query(
        `INSERT INTO transactions (
          account_id, 
          transaction_type, 
          amount, 
          currency, 
          balance_after, 
          description, 
          reference_number,
          related_account_id,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING *`,
        [
          accountId,
          transaction_type,
          transactionAmount.toFixed(2),
          currency,
          newBalance.toFixed(2),
          description,
          reference_number || `TXN-${accountId}-${Date.now()}`,
          related_account_id || null,
          'completed'
        ]
      );

      // Update account balance
      await db.query(
        'UPDATE accounts SET balance = $1 WHERE id = $2',
        [newBalance.toFixed(2), accountId]
      );

      await db.query('COMMIT');

      const transaction = transactionResult.rows[0];
      console.log(`✅ Transaction created for account ${accountId}:`, transaction);

      return NextResponse.json({
        success: true,
        data: transaction,
        message: 'Transaction completed successfully'
      }, { status: 201 });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to create transaction' }
    }, { status: 500 });
  }
}

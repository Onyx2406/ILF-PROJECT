import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';
import { updateWalletAddressStatus } from '@/lib/rafiki';

// READ - Get single account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id } = await params;
    const db = getDatabase();
    
    const result = await db.query(
      `SELECT 
        id,
        name,
        email,
        iban,
        currency,
        balance,
        account_type,
        status,
        wallet_address,
        wallet_id,
        asset_id,
        customer_id,
        username,
        password_hash,
        created_at,
        updated_at
      FROM accounts 
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Account not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch account' } },
      { status: 500 }
    );
  }
}

// UPDATE - Full update of account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id } = await params;
    const body = await request.json();
    
    const db = getDatabase();
    
    // First, get the current account data
    const currentResult = await db.query('SELECT * FROM accounts WHERE id = $1', [id]);
    
    if (currentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Account not found' } },
        { status: 404 }
      );
    }
    
    const currentAccount = currentResult.rows[0];
    
    // Use provided values or keep current values
    const name = body.name ?? currentAccount.name;
    const email = body.email ?? currentAccount.email;
    const currency = body.currency ?? currentAccount.currency;
    const balance = body.balance !== undefined ? body.balance : currentAccount.balance;
    const account_type = body.account_type ?? currentAccount.account_type;
    const status = body.status ?? currentAccount.status;
    
    // Check if status changed and account has a wallet ID
    const statusChanged = status !== currentAccount.status;
    const hasWalletId = currentAccount.wallet_id;
    
    // Update account in database
    const result = await db.query(
      `UPDATE accounts 
       SET name = $1, email = $2, currency = $3, balance = $4, 
           account_type = $5, status = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 
       RETURNING *`,
      [name, email, currency, balance, account_type, status, id]
    );

    // If status changed and account has wallet ID, update wallet status in Rafiki
    if (statusChanged && hasWalletId) {
      try {
        console.log(`🔄 Account status changed from ${currentAccount.status} to ${status}, updating wallet address...`);
        
        // Convert account status to wallet address status
        const walletStatus = status === 'active' ? 'ACTIVE' : 'INACTIVE';
        
        await updateWalletAddressStatus(
          currentAccount.wallet_id,
          walletStatus,
          name // Update public name as well
        );
        
        console.log(`✅ Wallet address status updated to ${walletStatus}`);
      } catch (walletError) {
        console.error('❌ Failed to update wallet address status:', walletError);
        // Log the error but don't fail the account update
        // The account status was successfully updated in our database
      }
    }

    return NextResponse.json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update account' } },
      { status: 500 }
    );
  }
}

// PATCH - Partial update of account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id } = await params;
    const body = await request.json();
    const db = getDatabase();
    
    // Get current account data first (for wallet status sync)
    const currentResult = await db.query('SELECT * FROM accounts WHERE id = $1', [id]);
    
    if (currentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Account not found' } },
        { status: 404 }
      );
    }
    
    const currentAccount = currentResult.rows[0];
    
    // Build dynamic update query based on provided fields
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    
    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'No fields to update' } },
        { status: 400 }
      );
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const query = `
      UPDATE accounts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} 
      RETURNING *
    `;
    
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Account not found' } },
        { status: 404 }
      );
    }

    // Check if status was updated and account has wallet ID
    const statusChanged = body.status && body.status !== currentAccount.status;
    const hasWalletId = currentAccount.wallet_id;
    
    if (statusChanged && hasWalletId) {
      try {
        console.log(`🔄 Account status changed from ${currentAccount.status} to ${body.status}, updating wallet address...`);
        
        // Convert account status to wallet address status
        const walletStatus = body.status === 'active' ? 'ACTIVE' : 'INACTIVE';
        
        await updateWalletAddressStatus(
          currentAccount.wallet_id,
          walletStatus,
          body.name || currentAccount.name // Use updated name if provided
        );
        
        console.log(`✅ Wallet address status updated to ${walletStatus}`);
      } catch (walletError) {
        console.error('❌ Failed to update wallet address status:', walletError);
        // Log the error but don't fail the account update
      }
    }

    return NextResponse.json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Error partially updating account:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update account' } },
      { status: 500 }
    );
  }
}

// DELETE - Hard delete account (permanently remove from database)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id } = await params;
    const db = getDatabase();
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // First, delete relationships
      await db.query('DELETE FROM customer_accounts WHERE account_id = $1', [id]);
      
      // Then delete the account
      const result = await db.query('DELETE FROM accounts WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        await db.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: { message: 'Account not found' } },
          { status: 404 }
        );
      }
      
      await db.query('COMMIT');
      return NextResponse.json({ 
        success: true, 
        message: 'Account deleted successfully',
        data: result.rows[0] 
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete account' } },
      { status: 500 }
    );
  }
}

// POST - Add balance to account (for Step 2 of account creation)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id } = await params;
    const { amount } = await request.json();
    
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Amount must be greater than 0' } },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // Get current account
      const accountResult = await db.query(
        'SELECT * FROM accounts WHERE id = $1',
        [id]
      );
      
      if (accountResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: { message: 'Account not found' } },
          { status: 404 }
        );
      }
      
      const account = accountResult.rows[0];
      const newBalance = parseFloat(account.balance || '0') + parseFloat(amount);
      const newAvailableBalance = parseFloat(account.available_balance || '0') + parseFloat(amount);
      const newBookBalance = parseFloat(account.book_balance || '0') + parseFloat(amount);
      
      // Update account balance - update all balance fields for consistency
      await db.query(
        `UPDATE accounts 
         SET balance = $1, 
             available_balance = $2, 
             book_balance = $3, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4`,
        [newBalance, newAvailableBalance, newBookBalance, id]
      );
      
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
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          id,
          'CREDIT',
          amount,
          account.currency,
          newAvailableBalance, // Use available balance as the primary balance reference
          'Initial balance deposit',
          `INIT-${Date.now()}`,
          'COMPLETED'
        ]
      );
      
      await db.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: 'Balance added successfully',
        data: {
          account: { 
            ...account, 
            balance: newBalance.toFixed(2),
            available_balance: newAvailableBalance.toFixed(2),
            book_balance: newBookBalance.toFixed(2)
          },
          transaction: transactionResult.rows[0]
        }
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error adding balance:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to add balance' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

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
    
    const result = await db.query(
      `UPDATE accounts 
       SET name = $1, email = $2, currency = $3, balance = $4, 
           account_type = $5, status = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 
       RETURNING *`,
      [name, email, currency, balance, account_type, status, id]
    );

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

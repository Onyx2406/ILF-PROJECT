import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

// GET - Get single customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id } = await params;
    const db = getDatabase();
    
    console.log(`📋 Fetching customer ${id} details...`);
    
    // Get customer details
    const customerResult = await db.query(
      'SELECT * FROM customers WHERE c_id = $1',
      [id]
    );

    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Customer not found' } },
        { status: 404 }
      );
    }

    console.log(`✅ Found customer: ${customerResult.rows[0].name}`);
    return NextResponse.json({ success: true, data: customerResult.rows[0] });

  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch customer' } },
      { status: 500 }
    );
  }
}

// PUT - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone_number, address, cnic, dob, status } = body;
    
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: { message: 'Name and email are required' } },
        { status: 400 }
      );
    }

    console.log(`🔄 Updating customer ${id}:`, { name, email, phone_number });

    const db = getDatabase();
    
    const result = await db.query(
      `UPDATE customers 
       SET name = $1, email = $2, phone_number = $3, address = $4, 
           cnic = $5, dob = $6, status = $7, updated_at = CURRENT_TIMESTAMP
       WHERE c_id = $8 
       RETURNING *`,
      [name, email, phone_number, address, cnic, dob, status || 'active', id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Customer not found' } },
        { status: 404 }
      );
    }

    console.log('✅ Customer updated successfully:', result.rows[0]);
    return NextResponse.json({ success: true, data: result.rows[0] });

  } catch (error: any) {
    console.error('Error updating customer:', error);
    
    if (error.code === '23505') {
      const field = error.constraint?.includes('email') ? 'email' : 'CNIC';
      return NextResponse.json(
        { success: false, error: { message: `${field} already exists` } },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update customer' } },
      { status: 500 }
    );
  }
}

// DELETE - Delete customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id } = await params;
    const db = getDatabase();
    
    console.log(`🗑️ Hard deleting customer ${id} and all associated accounts`);

    // Start a transaction to ensure data consistency
    await db.query('BEGIN');

    try {
      // First check if customer exists
      const customerCheck = await db.query(
        'SELECT * FROM customers WHERE c_id = $1',
        [id]
      );

      if (customerCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: { message: 'Customer not found' } },
          { status: 404 }
        );
      }

      const customer = customerCheck.rows[0];

      // Get all accounts associated with this customer
      const customerAccountsQuery = `
        SELECT a.id, a.name, a.iban, a.account_type 
        FROM accounts a
        INNER JOIN customer_accounts ca ON a.id = ca.account_id
        WHERE ca.customer_id = $1
      `;
      const accountsResult = await db.query(customerAccountsQuery, [id]);
      const associatedAccounts = accountsResult.rows;

      console.log(`📋 Found ${associatedAccounts.length} accounts to delete for customer ${id}`);

      // Delete all transactions for these accounts first
      if (associatedAccounts.length > 0) {
        const accountIds = associatedAccounts.map(acc => acc.id);
        const deleteTransactionsQuery = `DELETE FROM transactions WHERE account_id = ANY($1)`;
        const transactionsResult = await db.query(deleteTransactionsQuery, [accountIds]);
        console.log(`🗑️ Deleted ${transactionsResult.rowCount} transactions`);
      }

      // Delete all relationship records
      const deleteRelationsResult = await db.query(
        'DELETE FROM customer_accounts WHERE customer_id = $1',
        [id]
      );
      console.log(`🗑️ Deleted ${deleteRelationsResult.rowCount} customer-account relationships`);

      // Delete all associated accounts
      if (associatedAccounts.length > 0) {
        const accountIds = associatedAccounts.map(acc => acc.id);
        const deleteAccountsQuery = `DELETE FROM accounts WHERE id = ANY($1)`;
        const accountsDeleteResult = await db.query(deleteAccountsQuery, [accountIds]);
        console.log(`🗑️ Deleted ${accountsDeleteResult.rowCount} accounts`);
      }

      // Finally, delete the customer
      const result = await db.query(
        'DELETE FROM customers WHERE c_id = $1 RETURNING *',
        [id]
      );

      // Commit the transaction
      await db.query('COMMIT');

      console.log(`✅ Customer ${customer.name} and all associated data deleted successfully`);

      return NextResponse.json({
        success: true,
        message: `Customer and ${associatedAccounts.length} associated accounts deleted successfully`,
        data: {
          customer: result.rows[0],
          deleted_accounts: associatedAccounts.length,
          deleted_accounts_details: associatedAccounts
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('Error deleting customer:', error);
    
    // Handle foreign key constraint errors
    if (error.code === '23503') {
      return NextResponse.json(
        { success: false, error: { message: 'Cannot delete customer: customer has associated data that cannot be removed' } },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete customer' } },
      { status: 500 }
    );
  }
}
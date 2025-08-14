import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';
import { generateIBAN } from '@/lib/utils';

// GET - Get customer's accounts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id } = await params;
    const db = getDatabase();
    
    
    // Get customer's accounts through relationship table
    const accountsResult = await db.query(`
      SELECT 
        a.*,
        ca.relationship_type,
        ca.created_at as relationship_created_at
      FROM accounts a
      INNER JOIN customer_accounts ca ON a.id = ca.account_id
      WHERE ca.customer_id = $1
      ORDER BY ca.created_at DESC
    `, [id]);

    console.log(`✅ Found ${accountsResult.rows.length} accounts for customer ${id}`);

    return NextResponse.json({
      success: true,
      data: accountsResult.rows,
      count: accountsResult.rows.length
    });

  } catch (error) {
    console.error('Error fetching customer accounts:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch customer accounts' } },
      { status: 500 }
    );
  }
}

// POST - Create account for customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    
    const { id: customer_id } = await params;
    const body = await request.json();
    const { 
      name, 
      email, 
      currency = 'USD', 
      balance,
      account_type = 'savings' 
    } = body;
    
    // Use balance if provided, otherwise use initial_balance, default to 0.00
    const accountBalance = balance || '0.00';
    
    console.log(`🏦 Creating ${account_type} account for customer ${customer_id}:`, { 
      name, email, currency, account_type, balance, accountBalance 
    });

    const db = getDatabase();

    // Start transaction
    await db.query('BEGIN');

    try {
      // Check if customer exists
      const customerCheck = await db.query(
        'SELECT * FROM customers WHERE c_id = $1 AND status = $2',
        [customer_id, 'active']
      );

      if (customerCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          error: { message: 'Customer not found or inactive' }
        }, { status: 404 });
      }

      const customer = customerCheck.rows[0];

      // Create account with unique email per account
      const iban = generateIBAN();
      const finalBalance = parseFloat(accountBalance) || 0.00;
      
      // Generate unique email for each account
      const timestamp = Date.now();
      const accountEmail = email;
      const accountName = name;
      
      const accountResult = await db.query(
        `INSERT INTO accounts (name, email, iban, currency, balance, account_type) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [accountName, accountEmail, iban, currency, finalBalance.toFixed(2), account_type]
      );

      const account = accountResult.rows[0];

      // Link customer to account in relationship table
      await db.query(
        'INSERT INTO customer_accounts (customer_id, account_id, relationship_type) VALUES ($1, $2, $3)',
        [customer_id, account.id, 'PRIMARY']
      );

      await db.query('COMMIT');

      console.log(`✅ ${account_type} account created and linked to customer ${customer_id}:`, account);

      return NextResponse.json({
        success: true,
        data: account,
        message: `${account_type} account created successfully for customer`
      }, { status: 201 });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('Error creating account for customer:', error);
    
    if (error.code === '23505') {
      // Handle different unique constraint violations
      if (error.constraint === 'accounts_iban_key') {
        return NextResponse.json({
          success: false,
          error: { message: 'IBAN generation conflict, please try again' }
        }, { status: 400 });
      } else {
        return NextResponse.json({
          success: false,
          error: { message: 'Account with this combination already exists' }
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to create account' }
    }, { status: 500 });
  }
}
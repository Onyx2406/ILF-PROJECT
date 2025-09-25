import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';
import { generateIBAN } from '@/lib/utils';
import { generateUsername, hashPassword, DEFAULT_PASSWORD } from '@/lib/auth';

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
        a.id,
        a.name,
        a.email,
        a.iban,
        a.currency,
        a.balance,
        a.account_type,
        a.status,
        a.username,
        a.wallet_address,
        a.wallet_id,
        a.wallet_public_name,
        a.asset_id,
        a.created_at,
        a.updated_at,
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
      account_type = 'savings' 
    } = body;
    
    console.log(`🏦 Creating ${account_type} account for customer ${customer_id}:`, { 
      name, email, currency, account_type 
    });

    const db = getDatabase();

    // Start transaction
    await db.query('BEGIN');

    try {
      // Create account with 0 balance and generate internet banking credentials
      const iban = generateIBAN();
      const username = generateUsername(email || 'user@example.com', iban);
      const passwordHash = await hashPassword(DEFAULT_PASSWORD);
      
      console.log(`🔑 Generated credentials for account: username=${username}, password=${DEFAULT_PASSWORD}`);
      
      const accountResult = await db.query(
        `INSERT INTO accounts (
          name, email, iban, currency, balance, available_balance, book_balance, 
          account_type, customer_id, username, password_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING *`,
        [name || 'Account Holder', email || 'user@example.com', iban, currency, '0.00', '0.00', '0.00', account_type, customer_id, username, passwordHash]
      );

      const account = accountResult.rows[0];

      // Link customer to account in relationship table
      await db.query(
        'INSERT INTO customer_accounts (customer_id, account_id, relationship_type) VALUES ($1, $2, $3)',
        [customer_id, account.id, 'PRIMARY']
      );

      await db.query('COMMIT');

      console.log(`✅ ${account_type} account created with 0 balance and linked to customer ${customer_id}:`, account);

      return NextResponse.json({
        success: true,
        data: {
          ...account,
          // Include credentials in response (for display purposes)
          internetBanking: {
            username: username,
            password: DEFAULT_PASSWORD
          }
        },
        message: `${account_type} account created successfully for customer`
      }, { status: 201 });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('Error creating account for customer:', error);
    
    // Handle specific database constraint violations
    if (error.code === '23505') { // PostgreSQL unique violation error code
      if (error.constraint === 'accounts_iban_key') {
        return NextResponse.json({
          success: false,
          error: {
            message: 'IBAN generation conflict. Please try again.',
            code: 'IBAN_CONFLICT'
          }
        }, { status: 409 });
      } else if (error.constraint === 'accounts_username_key') {
        return NextResponse.json({
          success: false,
          error: {
            message: 'Username generation conflict. Please try again.',
            code: 'USERNAME_CONFLICT'
          }
        }, { status: 409 });
      }
    }
    
    // Handle foreign key constraint errors
    if (error.code === '23503') {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Customer not found or invalid customer ID.',
          code: 'INVALID_CUSTOMER'
        }
      }, { status: 400 });
    }
    
    // Generic error response
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to create account. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { verifyPassword } from '../../../../lib/auth';

// Database configuration
const dbConfig = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'abl_cbs',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    console.log('🔐 Core Banking Auth request for username:', username);

    if (!username || !password) {
      console.log('❌ Missing username or password');
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const client = new Client(dbConfig);
    await client.connect();

    try {
      // Find account by username
      const accountQuery = `
        SELECT a.*, c.name, c.email, c.phone_number, c.address, c.dob, c.status as customer_status
        FROM accounts a
        JOIN customers c ON a.customer_id = c.c_id
        WHERE a.username = $1
      `;
      
      const accountResult = await client.query(accountQuery, [username]);

      if (accountResult.rows.length === 0) {
        console.log('❌ No account found with username:', username);
        return NextResponse.json(
          { success: false, error: 'Invalid username or password' },
          { status: 401 }
        );
      }

      const account = accountResult.rows[0];
      
      // Verify password
      const isPasswordValid = await verifyPassword(password, account.password_hash);
      
      if (!isPasswordValid) {
        console.log('❌ Invalid password for username:', username);
        return NextResponse.json(
          { success: false, error: 'Invalid username or password' },
          { status: 401 }
        );
      }

      console.log('✅ Authentication successful for username:', username);

      // Get all accounts for this customer
      const customerAccountsQuery = `
        SELECT * FROM accounts WHERE customer_id = $1 ORDER BY created_at DESC
      `;
      
      const customerAccountsResult = await client.query(customerAccountsQuery, [account.customer_id]);

      return NextResponse.json({
        success: true,
        data: {
          customer: {
            id: account.customer_id,
            name: account.name,
            email: account.email,
            phone: account.phone_number,
            address: account.address,
            dob: account.dob,
            status: account.customer_status
          },
          accounts: customerAccountsResult.rows.map(acc => ({
            id: acc.id,
            name: acc.name,
            iban: acc.iban,
            currency: acc.currency,
            balance: acc.balance,
            status: acc.status,
            username: acc.username,
            created_at: acc.created_at
          })),
          authenticatedAccount: {
            id: account.id,
            username: account.username,
            iban: account.iban
          }
        },
        message: 'Authentication successful'
      });

    } finally {
      await client.end();
    }

  } catch (error: any) {
    console.error('❌ Core Banking Auth Error:', error.message);
    
    return NextResponse.json(
      { success: false, error: 'Authentication failed. Please try again.' },
      { status: 500 }
    );
  }
}

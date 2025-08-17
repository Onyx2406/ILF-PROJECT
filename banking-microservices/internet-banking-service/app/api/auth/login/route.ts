import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-internet-banking';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    console.log('🚀 Internet Banking LOGIN for username:', username);

    if (!username || !password) {
      console.log('❌ Missing username or password');
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    console.log('🔍 Authenticating with Core Banking Service...');

    // Call Core Banking Service authentication endpoint
    try {
      const coreUrl = 'http://core-banking:3200/api/auth/login';
      const response = await fetch(coreUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        console.log('❌ Authentication failed in Core Banking');
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { success: false, error: errorData.error || 'Invalid username or password' },
          { status: 401 }
        );
      }

      const result = await response.json();
      
      if (!result.success) {
        console.log('❌ Authentication rejected by Core Banking');
        return NextResponse.json(
          { success: false, error: result.error || 'Invalid username or password' },
          { status: 401 }
        );
      }

      const { customer, accounts, authenticatedAccount } = result.data;
      console.log('👤 Customer authenticated:', customer.name, 'ID:', customer.id);
      console.log('🔐 Authenticated account:', authenticatedAccount.username);

      // Generate JWT token for Internet Banking session
      const token = jwt.sign(
        { 
          customerId: customer.id, 
          email: customer.email,
          name: customer.name,
          username: authenticatedAccount.username,
          accountId: authenticatedAccount.id
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`✅ SUCCESS! Internet Banking login for: ${customer.name} (${authenticatedAccount.username}) with ${accounts.length} accounts`);

      return NextResponse.json({
        success: true,
        token,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          status: customer.status,
        },
        accounts: accounts,
        authenticatedAccount: authenticatedAccount,
        message: 'Login successful!'
      });

    } catch (fetchError: any) {
      console.error('❌ Network error connecting to Core Banking:', fetchError.message);
      return NextResponse.json(
        { success: false, error: 'Service temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }

  } catch (error: any) {
    console.error('❌ Internet Banking LOGIN ERROR:', error.message);
    
    return NextResponse.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}

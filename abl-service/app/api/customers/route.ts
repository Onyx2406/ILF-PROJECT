import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

// GET - Get all customers
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    
    const db = getDatabase();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        c.*,
        COUNT(ca.account_id) as account_count
      FROM customers c
      LEFT JOIN customer_accounts ca ON c.c_id = ca.customer_id
    `;
    
    let params: any[] = [];
    
    if (search) {
      query += ` WHERE (c.name ILIKE $1 OR c.email ILIKE $1 OR c.cnic ILIKE $1)`;
      params.push(`%${search}%`);
    }
    
    query += `
      GROUP BY c.c_id
      ORDER BY c.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM customers';
    let countParams: any[] = [];
    
    if (search) {
      countQuery += ' WHERE (name ILIKE $1 OR email ILIKE $1 OR cnic ILIKE $1)';
      countParams.push(`%${search}%`);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch customers' } },
      { status: 500 }
    );
  }
}

// POST - Create new customer
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    
    const body = await request.json();
    const { name, email, phone_number, address, cnic, dob } = body;
    
    console.log('� Creating new customer:', { name, email, phone_number, address, cnic, dob });

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: { message: 'Name and email are required' } },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    const result = await db.query(
      `INSERT INTO customers (name, email, phone_number, address, cnic, dob) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [name, email, phone_number, address, cnic, dob]
    );

    console.log('✅ Customer created successfully:', result.rows[0]);

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error creating customer:', error);
    
    if (error.code === '23505') {
      const field = error.constraint?.includes('email') ? 'email' : 'cnic';
      return NextResponse.json(
        { success: false, error: { message: `${field.toUpperCase()} already exists` } },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create customer' } },
      { status: 500 }
    );
  }
}
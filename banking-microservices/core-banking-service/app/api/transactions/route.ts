import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

// GET - Fetch all transactions across all accounts
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    
    const offset = (page - 1) * limit;
    const db = getDatabase();
    
    // Build WHERE conditions
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      conditions.push(`(
        t.description ILIKE $${paramIndex} OR 
        t.reference_number ILIKE $${paramIndex} OR 
        a.iban ILIKE $${paramIndex} OR 
        c.name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (type && type !== 'all') {
      conditions.push(`t.transaction_type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }
    
    if (status && status !== 'all') {
      conditions.push(`t.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN customer_accounts ca ON a.id = ca.account_id
      JOIN customers c ON ca.customer_id = c.c_id
      ${whereClause}
    `;
    
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    // Get transactions with pagination
    const transactionsQuery = `
      SELECT 
        t.*,
        a.name as account_name,
        a.iban as account_iban,
        c.name as customer_name,
        c.c_id as customer_id,
        ra.name as related_account_name,
        ra.iban as related_account_iban
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN customer_accounts ca ON a.id = ca.account_id
      JOIN customers c ON ca.customer_id = c.c_id
      LEFT JOIN accounts ra ON t.related_account_id = ra.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const result = await db.query(transactionsQuery, params);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;
    
    return NextResponse.json({
      success: true,
      data: {
        transactions: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch transactions' } },
      { status: 500 }
    );
  }
}

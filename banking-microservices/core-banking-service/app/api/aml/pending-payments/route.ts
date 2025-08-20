import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

// GET - Retrieve pending payments for AML screening
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabase();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const riskLevel = searchParams.get('riskLevel'); // LOW, MEDIUM, HIGH

    // Build query with filters
    let query = `
      SELECT 
        pp.*,
        a.name as account_name,
        a.email as account_email,
        a.iban as account_iban,
        a.currency as account_currency,
        a.available_balance,
        a.book_balance,
        w.data as webhook_data
      FROM pending_payments pp
      JOIN accounts a ON pp.account_id = a.id
      LEFT JOIN webhooks w ON pp.webhook_id = w.id::text
      WHERE pp.status = $1
    `;
    
    const params: any[] = [status];
    let paramCount = 1;

    // Risk level filter
    if (riskLevel) {
      paramCount++;
      if (riskLevel === 'LOW') {
        query += ` AND pp.risk_score <= 30`;
      } else if (riskLevel === 'MEDIUM') {
        query += ` AND pp.risk_score > 30 AND pp.risk_score <= 70`;
      } else if (riskLevel === 'HIGH') {
        query += ` AND pp.risk_score > 70`;
      }
    }

    query += ' ORDER BY pp.created_at DESC';
    
    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await db.query(query, params);
    
    // Get summary statistics
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_pending,
        COUNT(CASE WHEN risk_score <= 30 THEN 1 END) as low_risk,
        COUNT(CASE WHEN risk_score > 30 AND risk_score <= 70 THEN 1 END) as medium_risk,
        COUNT(CASE WHEN risk_score > 70 THEN 1 END) as high_risk,
        SUM(amount) as total_amount,
        COUNT(CASE WHEN auto_approval_eligible = true THEN 1 END) as auto_eligible
      FROM pending_payments 
      WHERE status = 'PENDING'
    `);

    const stats = statsResult.rows[0];
    
    const pendingPayments = result.rows.map(row => ({
      id: row.id,
      webhookId: row.webhook_id,
      accountId: row.account_id,
      accountName: row.account_name,
      accountEmail: row.account_email,
      accountIban: row.account_iban,
      amount: parseFloat(row.amount),
      currency: row.account_currency, // Use account currency instead of pending payment currency
      paymentReference: row.payment_reference,
      paymentSource: row.payment_source,
      senderInfo: row.sender_info,
      riskScore: row.risk_score,
      riskLevel: row.risk_score <= 30 ? 'LOW' : row.risk_score <= 70 ? 'MEDIUM' : 'HIGH',
      status: row.status,
      screeningNotes: row.screening_notes,
      screenedBy: row.screened_by,
      screenedAt: row.screened_at,
      autoApprovalEligible: row.auto_approval_eligible,
      createdAt: row.created_at,
      availableBalance: parseFloat(row.available_balance),
      bookBalance: parseFloat(row.book_balance),
      webhookData: row.webhook_data
    }));

    return NextResponse.json({
      success: true,
      data: {
        pendingPayments,
        stats: {
          totalPending: parseInt(stats.total_pending || '0'),
          lowRisk: parseInt(stats.low_risk || '0'),
          mediumRisk: parseInt(stats.medium_risk || '0'),
          highRisk: parseInt(stats.high_risk || '0'),
          totalAmount: parseFloat(stats.total_amount || '0'),
          autoEligible: parseInt(stats.auto_eligible || '0')
        },
        pagination: {
          limit,
          offset,
          total: result.rows.length
        }
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ AML: Error retrieving pending payments:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to retrieve pending payments' } },
      { status: 500 }
    );
  }
}

// POST - Approve or reject pending payment
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { paymentId, action, screeningNotes, screenedBy } = data;
    
    if (!paymentId || !action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid request. Required: paymentId, action (APPROVE/REJECT)' } },
        { status: 400 }
      );
    }

    await ensureDatabaseInitialized();
    const db = getDatabase();
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // Get pending payment details
      const paymentResult = await db.query(
        'SELECT * FROM pending_payments WHERE id = $1 AND status = $2 FOR UPDATE',
        [paymentId, 'PENDING']
      );
      
      if (paymentResult.rows.length === 0) {
        throw new Error('Pending payment not found or already processed');
      }
      
      const payment = paymentResult.rows[0];
      
      if (action === 'APPROVE') {
        // Move amount from book balance to available balance
        await db.query(
          `UPDATE accounts 
           SET available_balance = available_balance + $1,
               balance = available_balance + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [payment.amount, payment.account_id]
        );
        
        // Update transaction status to completed
        await db.query(
          `UPDATE transactions 
           SET status = 'COMPLETED', description = description || ' - APPROVED'
           WHERE reference_number LIKE $1 
           AND account_id = $2 AND status = 'PENDING'`,
          [`%${String(payment.webhook_id).slice(-8)}%`, payment.account_id]
        );
        
        console.log(`✅ AML: Payment ${paymentId} approved - Amount moved to available balance`);
        
      } else if (action === 'REJECT') {
        // Reverse the book balance credit
        await db.query(
          `UPDATE accounts 
           SET book_balance = book_balance - $1,
               updated_at = NOW()
           WHERE id = $2`,
          [payment.amount, payment.account_id]
        );
        
        // Update transaction status to rejected
        await db.query(
          `UPDATE transactions 
           SET status = 'REJECTED', description = description || ' - REJECTED'
           WHERE reference_number LIKE $1 
           AND account_id = $2 AND status = 'PENDING'`,
          [`%${String(payment.webhook_id).slice(-8)}%`, payment.account_id]
        );
        
        console.log(`❌ AML: Payment ${paymentId} rejected - Book balance reversed`);
      }
      
      // Update pending payment status
      await db.query(
        `UPDATE pending_payments 
         SET status = $1, screening_notes = $2, screened_by = $3, screened_at = NOW(), updated_at = NOW()
         WHERE id = $4`,
        [action === 'APPROVE' ? 'APPROVED' : 'REJECTED', screeningNotes, screenedBy, paymentId]
      );
      
      // Commit transaction
      await db.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: `Payment ${action.toLowerCase()}d successfully`,
        data: {
          paymentId,
          action,
          screeningNotes,
          processedAt: new Date().toISOString()
        }
      }, { status: 200 });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('❌ AML: Error processing payment approval:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to process payment approval' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';
import { createReversalPayment } from '@/lib/rafiki';

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
      LEFT JOIN webhooks w ON pp.webhook_id = w.id
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
      currency: row.currency, // Use pending payment currency (converted currency)
      originalAmount: row.original_amount ? parseFloat(row.original_amount) : null,
      originalCurrency: row.original_currency,
      conversionRate: row.conversion_rate ? parseFloat(row.conversion_rate) : null,
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
      
      // Declare variables for reversal tracking (needed in response)
      let reversalResult: any = null;
      let senderWalletAddress: string | null = null;
      
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
        
        // Update the existing PENDING transaction to COMPLETED status
        await db.query(
          `UPDATE transactions 
           SET status = 'COMPLETED', 
               transaction_type = 'CREDIT',
               description = REPLACE(description, 'Pending AML', 'Approved via AML screening')
           WHERE reference_number LIKE $1 
           AND account_id = $2 AND status = 'PENDING'`,
          [`%${String(payment.webhook_id).slice(-8)}%`, payment.account_id]
        );
        
        console.log(`✅ AML: Payment ${paymentId} approved - Amount moved to available balance, transaction marked as COMPLETED`);
        
      } else if (action === 'REJECT') {
        console.log(`🚨 Processing AML pending payment rejection with complete reversal flow...`);
        console.log(`📋 Payment ID: ${paymentId}, Amount: ${payment.amount}, Currency: ${payment.currency}`);
        
        // Get webhook data to extract sender information
        let webhookData = null;
        
        if (payment.webhook_id) {
          const webhookResult = await db.query(`
            SELECT * FROM webhooks 
            WHERE id = $1
          `, [payment.webhook_id]);

          if (webhookResult.rows.length > 0) {
            const webhook = webhookResult.rows[0];
            webhookData = webhook.data;
            
            // Try multiple ways to extract sender wallet address
            if (webhookData?.metadata?.senderWalletAddress) {
              senderWalletAddress = webhookData.metadata.senderWalletAddress;
              console.log('📋 Found sender wallet address in metadata:', senderWalletAddress);
            } else if (webhookData?.walletAddressId) {
              // Try to find the wallet address by wallet_id
              console.log('🔍 Looking up sender wallet address via walletAddressId:', webhookData.walletAddressId);
              const senderAccountResult = await db.query(
                'SELECT wallet_address FROM accounts WHERE wallet_id = $1',
                [webhookData.walletAddressId]
              );
              
              if (senderAccountResult.rows.length > 0) {
                senderWalletAddress = senderAccountResult.rows[0].wallet_address;
                console.log('✅ Found sender wallet address via wallet_id lookup:', senderWalletAddress);
              } else {
                console.log('⚠️ No account found for wallet_id:', webhookData.walletAddressId);
              }
            } else {
              console.log('⚠️ No sender wallet address in webhook metadata');
              console.log('📋 Available webhook data fields:', Object.keys(webhookData || {}));
            }
          }
        }

        // STEP 1: Credit the payment to receiver's account first (simulate payment arriving)
        console.log('💰 Step 1: Crediting payment to receiver account...');
        
        // Get current account balance first
        const accountBeforeCredit = await db.query(
          'SELECT available_balance FROM accounts WHERE id = $1',
          [payment.account_id]
        );
        const balanceBeforeCredit = parseFloat(accountBeforeCredit.rows[0].available_balance || '0');
        const balanceAfterCredit = balanceBeforeCredit + parseFloat(payment.amount);
        
        await db.query(
          `UPDATE accounts 
           SET available_balance = available_balance + $1,
               book_balance = book_balance + $1,
               balance = available_balance + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [payment.amount, payment.account_id]
        );
        
        // Create transaction record for the credit
        await db.query(
          `INSERT INTO transactions (
            account_id, amount, currency, transaction_type, status, 
            description, reference_number, balance_after, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            payment.account_id,
            payment.amount,
            payment.currency,
            'CREDIT',
            'COMPLETED',
            `Pending payment credited (webhook ${payment.webhook_id}) - To be reversed due to AML rejection`,
            `CREDIT-PENDING-${payment.webhook_id}`,
            balanceAfterCredit
          ]
        );

        console.log('✅ Payment credited to receiver account');

        // STEP 2: Immediately debit the same amount (preparing for reversal)
        console.log('💰 Step 2: Immediately debiting from receiver account for reversal...');
        
        const balanceAfterDebit = balanceAfterCredit - parseFloat(payment.amount);
        
        await db.query(
          `UPDATE accounts 
           SET available_balance = available_balance - $1,
               book_balance = book_balance - $1,
               balance = available_balance - $1,
               updated_at = NOW()
           WHERE id = $2`,
          [payment.amount, payment.account_id]
        );
        
        // Create transaction record for the debit
        await db.query(
          `INSERT INTO transactions (
            account_id, amount, currency, transaction_type, status, 
            description, reference_number, balance_after, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            payment.account_id,
            payment.amount,
            payment.currency,
            'DEBIT',
            'COMPLETED',
            `AML Rejection - Debiting for reversal to sender`,
            `DEBIT-REVERSAL-PENDING-${payment.webhook_id}`,
            balanceAfterDebit
          ]
        );

        console.log('✅ Amount debited from receiver account for reversal');

        // Update the original PENDING transaction to REJECTED status  
        await db.query(
          `UPDATE transactions 
           SET status = 'REJECTED', 
               description = description || ' - REJECTED via AML screening'
           WHERE reference_number LIKE $1 
           AND account_id = $2 AND status = 'PENDING'`,
          [`%${String(payment.webhook_id).slice(-8)}%`, payment.account_id]
        );

        // STEP 3: Create reversal payment back to sender using Rafiki (if we have sender info)
        
        if (senderWalletAddress) {
          try {
            console.log('💸 Step 3: Creating reversal payment to sender via Rafiki...');
            
            reversalResult = await createReversalPayment(
              senderWalletAddress,
              payment.amount.toString(),
              payment.currency,
              payment.webhook_id.toString(),
              `AML Pending Payment Rejection Reversal: ${screeningNotes || 'AML screening rejection'}`,
              db,
              webhookData
            );

            console.log('✅ Reversal payment created successfully:', reversalResult.payment.id);

          } catch (reversalError: any) {
            console.error('❌ Failed to create Rafiki reversal payment:', reversalError.message);
            reversalResult = {
              success: false,
              error: reversalError.message,
              payment: null
            };
          }
        } else {
          console.log('⚠️ No sender wallet address available - cannot create reversal payment');
          reversalResult = {
            success: false,
            error: 'Sender wallet address not available in webhook metadata',
            payment: null
          };
        }
        
        console.log(`❌ AML: Pending payment ${paymentId} rejected with complete reversal flow`);
        console.log('📊 Summary:');
        console.log('   ✅ Payment credited to receiver');
        console.log('   ✅ Payment debited from receiver'); 
        console.log('   ✅ Original transaction marked as rejected');
        console.log('   ' + (reversalResult?.success ? '✅' : '❌') + ' Reversal payment ' + (reversalResult?.success ? 'sent to sender' : 'failed'));
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
      
      // Prepare response based on action
      let responseMessage = `Payment ${action.toLowerCase()}d successfully`;
      let responseData: any = {
        paymentId,
        action,
        screeningNotes,
        processedAt: new Date().toISOString()
      };

      // Add reversal information for rejected payments
      if (action === 'REJECT' && reversalResult) {
        responseMessage = 'Payment rejected with complete reversal flow';
        responseData.paymentFlow = {
          step1: 'Payment credited to receiver account',
          step2: 'Payment immediately debited from receiver account',
          step3: reversalResult.success 
            ? 'Reversal payment sent to original sender' 
            : 'Reversal payment failed - manual intervention required'
        };
        responseData.reversal = reversalResult.success ? {
          status: 'COMPLETED',
          paymentId: reversalResult.payment.id,
          amount: payment.amount,
          currency: payment.currency,
          recipient: senderWalletAddress
        } : {
          status: 'FAILED',
          error: reversalResult.error || 'No sender information available'
        };
      }
      
      return NextResponse.json({
        success: true,
        message: responseMessage,
        data: responseData
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

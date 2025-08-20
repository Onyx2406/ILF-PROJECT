import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

interface RafikiWebhookData {
  id: string;
  type: string;
  data: {
    id: string;
    walletAddressId?: string;
    accountId?: string;
    receivedAmount?: {
      value: string;
      assetCode: string;
      assetScale: number;
    };
    incomingAmount?: {
      value: string;
      assetCode: string;
      assetScale: number;
    };
    [key: string]: any;
  };
  resourceId?: string;
  createdAt: string;
  forwardedBy?: string;
  forwardedAt?: string;
  originalSource?: string;
}

// POST - Handle webhook from OC service
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    console.log('� CBS: Received webhook from OC service:', {
      type: data.type,
      id: data.id,
      source: request.headers.get('x-forwarded-by') || 'direct'
    });

    // Validate webhook structure
    if (!data.id || !data.type || !data.data) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid webhook format' } },
        { status: 400 }
      );
    }

    // Extract metadata from headers  
    const forwardedBy = request.headers.get('x-forwarded-by') || 'unknown';
    const forwardedAt = request.headers.get('x-forwarded-at') || new Date().toISOString();
    const originalSource = request.headers.get('x-original-source') || forwardedBy;

    // Extract payment amount if available
    const paymentAmount = extractPaymentAmount(data);
    
    // Find associated account by wallet address
    await ensureDatabaseInitialized();
    const db = getDatabase();
    
    let accountId: number | null = null;
    const walletAddressId = data.data.walletAddressId || data.data.payment?.walletAddressId || data.data.walletAddress || data.walletAddress;
    
    if (walletAddressId) {
      console.log(`🔍 CBS: Looking for account with wallet_id: ${walletAddressId}`);
      
      // Find account by wallet_id
      const accountResult = await db.query(
        'SELECT id, name FROM accounts WHERE wallet_id = $1',
        [walletAddressId]
      );
      
      if (accountResult.rows.length > 0) {
        accountId = accountResult.rows[0].id;
        console.log(`✅ CBS: Found account ID ${accountId} for ${accountResult.rows[0].name}`);
      } else {
        console.log(`❌ CBS: No account found for wallet_id: ${walletAddressId}`);
        
        // Debug: Show what accounts exist
        const debugResult = await db.query(
          'SELECT id, name, wallet_id FROM accounts WHERE wallet_id IS NOT NULL'
        );
        console.log('💡 CBS: Available wallet accounts:', debugResult.rows);
      }
    } else {
      console.log('❌ CBS: No wallet address found in webhook data');
    }

    // Store webhook in database
    const insertResult = await db.query(
      `INSERT INTO webhooks (
        webhook_type, status, data, wallet_address_id, account_id,
        forwarded_by, forwarded_at, original_source,
        payment_amount, payment_currency, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id`,
      [
        data.type,
        'received',
        JSON.stringify(data.data),
        walletAddressId || null,  // Keep this field for webhook storage but use wallet_id for account lookup
        accountId,
        forwardedBy,
        forwardedAt,
        originalSource,
        paymentAmount?.amount || null,
        paymentAmount?.currency || null
      ]
    );

    const webhookId = insertResult.rows[0].id;
    
    // Update the webhook data with the database ID for processing
    const webhookData = {
      ...data,
      id: webhookId
    };

    // Process the webhook asynchronously
    processWebhook(webhookData, accountId, paymentAmount, db).catch(error => {
      console.error('❌ CBS: Background webhook processing failed:', error.message);
    });

    console.log('✅ CBS: Webhook stored and processing initiated');

    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed',
      data: {
        id: webhookId,
        type: data.type,
        timestamp: new Date().toISOString(),
        forwardedBy,
        originalSource,
        accountId,
        paymentAmount
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ CBS: Error processing webhook:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to process webhook' } },
      { status: 500 }
    );
  }
}

// GET - Retrieve stored webhooks from database
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabase();
    
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    // Build query with filters
    let query = 'SELECT * FROM webhooks WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      query += ` AND webhook_type = $${paramCount}`;
      params.push(type);
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(limitNum);
      }
    }

    const result = await db.query(query, params);
    const webhooks = result.rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      type: row.webhook_type,
      data: row.data,
      walletAddressId: row.wallet_address_id,
      accountId: row.account_id,
      status: row.status,
      forwardedBy: row.forwarded_by,
      forwardedAt: row.forwarded_at,
      originalSource: row.original_source,
      paymentAmount: row.payment_amount,
      paymentCurrency: row.payment_currency,
      processedAt: row.processed_at,
      errorMessage: row.error_message
    }));

    // Get statistics
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'received' THEN 1 END) as received,
        COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error,
        webhook_type,
        COUNT(*) as type_count
      FROM webhooks 
      GROUP BY webhook_type
    `);

    const stats = {
      total: parseInt(statsResult.rows[0]?.total || '0'),
      byStatus: {
        received: parseInt(statsResult.rows[0]?.received || '0'),
        processed: parseInt(statsResult.rows[0]?.processed || '0'),
        error: parseInt(statsResult.rows[0]?.error || '0')
      },
      byType: statsResult.rows.reduce((acc: any, row) => {
        acc[row.webhook_type] = parseInt(row.type_count);
        return acc;
      }, {}),
      lastWebhook: webhooks[0]?.timestamp || null
    };

    return NextResponse.json({
      success: true,
      data: {
        webhooks,
        stats,
        total: webhooks.length,
        filters: { type, status, limit }
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ CBS: Error retrieving webhooks:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to retrieve webhooks' } },
      { status: 500 }
    );
  }
}

// DELETE - Clear webhook history
export async function DELETE() {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabase();
    
    await db.query('DELETE FROM webhooks');
    
    return NextResponse.json({
      success: true,
      message: 'Webhook history cleared'
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ CBS: Error clearing webhooks:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to clear webhooks' } },
      { status: 500 }
    );
  }
}

/**
 * Extract payment amount from webhook data
 */
function extractPaymentAmount(webhook: RafikiWebhookData) {
  const data = webhook.data;
  
  // Try direct receivedAmount first (actual Rafiki webhook structure)
  if (data.receivedAmount) {
    return {
      amount: parseFloat(data.receivedAmount.value) / Math.pow(10, data.receivedAmount.assetScale || 2),
      currency: data.receivedAmount.assetCode || 'USD'
    };
  }
  
  // Try direct incomingAmount
  if (data.incomingAmount) {
    return {
      amount: parseFloat(data.incomingAmount.value) / Math.pow(10, data.incomingAmount.assetScale || 2),
      currency: data.incomingAmount.assetCode || 'USD'
    };
  }
  
  // Try payment.incomingAmount (nested structure fallback)
  if (data.payment?.incomingAmount) {
    return {
      amount: parseFloat(data.payment.incomingAmount.value) / Math.pow(10, data.payment.incomingAmount.assetScale || 2),
      currency: data.payment.incomingAmount.assetCode || 'USD'
    };
  }
  
  // Try payment.receivedAmount
  if (data.payment?.receivedAmount) {
    return {
      amount: parseFloat(data.payment.receivedAmount.value) / Math.pow(10, data.payment.receivedAmount.assetScale || 2),
      currency: data.payment.receivedAmount.assetCode || 'USD'
    };
  }
  
  return null;
}

/**
 * Process webhook and update account balance if applicable
 */
async function processWebhook(webhook: RafikiWebhookData, accountId: number | null, paymentAmount: any, db: any) {
  try {
    console.log(`📋 CBS: Processing webhook type: ${webhook.type}`);

    await db.query(
      'UPDATE webhooks SET status = $1, processed_at = NOW() WHERE id = $2',
      ['processing', webhook.id]
    );

    switch (webhook.type) {
      case 'incoming_payment.completed':
        console.log('💰 CBS: Incoming payment completed:', webhook.data.id);
        
        if (accountId && paymentAmount) {
          await creditBookBalanceAndCreatePendingPayment(accountId, paymentAmount.amount, paymentAmount.currency, webhook, db);
          console.log(`✅ CBS: Account ${accountId} book balance credited with ${paymentAmount.amount} ${paymentAmount.currency} - Payment pending AML screening`);
        } else {
          console.log('⚠️ CBS: No account ID or payment amount found for crediting');
        }
        break;
        
      case 'incoming_payment.created':
        console.log('📥 CBS: Incoming payment created:', webhook.data.id);
        break;
        
      case 'incoming_payment.expired':
        console.log('⏰ CBS: Incoming payment expired:', webhook.data.id);
        break;
        
      case 'outgoing_payment.created':
        console.log('📤 CBS: Outgoing payment created:', webhook.data.id);
        break;
        
      case 'outgoing_payment.completed':
        console.log('✅ CBS: Outgoing payment completed:', webhook.data.id);
        // Note: Outgoing payments would typically debit the account,
        // but that should be handled when the payment is initiated
        break;
        
      case 'outgoing_payment.failed':
        console.log('❌ CBS: Outgoing payment failed:', webhook.data.id);
        break;
        
      case 'wallet_address.not_found':
        console.log('🔍 CBS: Wallet address not found:', webhook.data);
        break;
        
      case 'wallet_address.web_monetization':
        console.log('💻 CBS: Web monetization payment:', webhook.data);
        break;
        
      case 'asset.liquidity_low':
      case 'peer.liquidity_low':
        console.log('⚠️ CBS: Low liquidity alert:', webhook.type);
        break;
        
      default:
        console.log(`❓ CBS: Unknown webhook type: ${webhook.type}`);
        break;
    }

    // Update status to processed
    await db.query(
      'UPDATE webhooks SET status = $1, processed_at = NOW() WHERE id = $2',
      ['processed', webhook.id]
    );
    
  } catch (error: any) {
    console.error(`❌ CBS: Error processing webhook ${webhook.id}:`, error.message);
    
    // Update status to error
    await db.query(
      'UPDATE webhooks SET status = $1, error_message = $2, processed_at = NOW() WHERE id = $3',
      ['error', error.message, webhook.id]
    );
  }
}

/**
 * Credit book balance and create pending payment for AML screening
 */
async function creditBookBalanceAndCreatePendingPayment(accountId: number, amount: number, currency: string, webhook: RafikiWebhookData, db: any) {
  try {
    // Start transaction
    await db.query('BEGIN');
    
    // Get current account details
    const accountResult = await db.query(
      'SELECT * FROM accounts WHERE id = $1 FOR UPDATE',
      [accountId]
    );
    
    if (accountResult.rows.length === 0) {
      throw new Error(`Account ${accountId} not found`);
    }
    
    const account = accountResult.rows[0];
    const currentBookBalance = parseFloat(account.book_balance || account.balance || 0);
    const newBookBalance = currentBookBalance + amount;
    
    // Update book balance only (available balance stays the same)
    await db.query(
      'UPDATE accounts SET book_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBookBalance.toFixed(2), accountId]
    );
    
    // Create pending payment record for AML screening
    const pendingPaymentResult = await db.query(
      `INSERT INTO pending_payments (
        webhook_id, account_id, amount, currency, payment_reference,
        payment_source, sender_info, risk_score, status, auto_approval_eligible
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        webhook.id,
        accountId,
        amount,
        currency,
        `RAFIKI-${webhook.data.id}`,
        `Incoming payment from Rafiki wallet: ${webhook.data.client || 'Unknown'}`,
        JSON.stringify({
          walletAddressId: webhook.data.walletAddressId,
          client: webhook.data.client,
          metadata: webhook.data.metadata
        }),
        calculateRiskScore(webhook.data), // Risk assessment
        'PENDING',
        amount < 1000 // Auto-approve small amounts under $1000
      ]
    );
    
    const pendingPaymentId = pendingPaymentResult.rows[0].id;
    
    // Create transaction record for book balance credit
    const transactionRef = `WH-${String(webhook.id).slice(-8)}-${Date.now()}`;
    await db.query(
      `INSERT INTO transactions (
        account_id, transaction_type, amount, currency, balance_after,
        description, reference_number, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        accountId,
        'CREDIT_PENDING',
        amount,
        currency,
        newBookBalance.toFixed(2),
        `Incoming payment from Rafiki (Pending AML): ${webhook.data.id}`,
        transactionRef,
        'PENDING'
      ]
    );
    
    // Commit transaction
    await db.query('COMMIT');
    
    console.log(`� CBS: Pending payment ${pendingPaymentId} created for AML screening`);
    console.log(`💳 CBS: Book balance updated: ${newBookBalance}, Transaction: ${transactionRef}`);
    
  } catch (error: any) {
    // Rollback transaction
    await db.query('ROLLBACK');
    throw error;
  }
}

/**
 * Calculate risk score based on payment data
 */
function calculateRiskScore(paymentData: any): number {
  let riskScore = 0;
  
  // Base score for all incoming payments
  riskScore += 10;
  
  // Amount-based risk
  const amount = parseFloat(paymentData.receivedAmount?.value || paymentData.incomingAmount?.value || 0) / 100;
  if (amount > 10000) riskScore += 30;
  else if (amount > 5000) riskScore += 20;
  else if (amount > 1000) riskScore += 10;
  
  // Source-based risk
  if (!paymentData.client || paymentData.client.includes('unknown')) {
    riskScore += 20;
  }
  
  // Metadata analysis
  if (paymentData.metadata?.description?.toLowerCase().includes('urgent')) {
    riskScore += 15;
  }
  
  return Math.min(riskScore, 100); // Cap at 100
}

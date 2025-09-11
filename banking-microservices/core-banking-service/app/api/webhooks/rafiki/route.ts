import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';
import { convertUSDtoPKR, needsCurrencyConversion, formatCurrencyAmount, calculateConversionRisk } from '@/lib/currency';
import { AIMLBlockService } from '@/lib/aiml-block-service';

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
        'SELECT id, name, currency FROM accounts WHERE wallet_id = $1',
        [walletAddressId]
      );
      
      if (accountResult.rows.length > 0) {
        accountId = accountResult.rows[0].id;
        console.log(`✅ CBS: Found account ID ${accountId} for ${accountResult.rows[0].name} (${accountResult.rows[0].currency})`);
      } else {
        console.log(`❌ CBS: No account found for wallet_id: ${walletAddressId}`);
        
        // Debug: Show what accounts exist
        const debugResult = await db.query(
          'SELECT id, name, wallet_id, currency FROM accounts WHERE wallet_id IS NOT NULL'
        );
        console.log('💡 CBS: Available wallet accounts:', debugResult.rows);
      }
    } else {
      console.log('❌ CBS: No wallet address found in webhook data');
    }

    // Store webhook in database
    const insertResult = await db.query(
      `INSERT INTO webhooks (
        id, webhook_type, status, data, wallet_address_id, account_id,
        forwarded_by, forwarded_at, original_source,
        payment_amount, payment_currency, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING id`,
      [
        data.id, // Use the webhook ID from the request
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
      case 'incoming.payment.completed':
      case 'incoming_payment.completed':
        console.log('💰 CBS: Incoming payment completed:', webhook.data.id);
        
        if (accountId && paymentAmount) {
          await creditBookBalanceAndCreatePendingPayment(accountId, paymentAmount.amount, paymentAmount.currency, webhook, db);
          console.log(`✅ CBS: Account ${accountId} book balance credited with ${paymentAmount.amount} ${paymentAmount.currency} - Payment pending AML screening`);
        } else {
          console.log('⚠️ CBS: No account ID or payment amount found for crediting');
        }
        break;
        
      case 'incoming.payment.created':
      case 'incoming_payment.created':
        console.log('📥 CBS: Incoming payment created:', webhook.data.id);
        break;
        
      case 'incoming.payment.expired':
      case 'incoming_payment.expired':
        console.log('⏰ CBS: Incoming payment expired:', webhook.data.id);
        break;
        
      case 'outgoing.payment.created':
      case 'outgoing_payment.created':
        console.log('📤 CBS: Outgoing payment created:', webhook.data.id);
        break;
        
      case 'outgoing.payment.completed':
      case 'outgoing_payment.completed':
        console.log('✅ CBS: Outgoing payment completed:', webhook.data.id);
        // Note: Outgoing payments would typically debit the account,
        // but that should be handled when the payment is initiated
        break;
        
      case 'outgoing.payment.failed':
      case 'outgoing_payment.failed':
        console.log('❌ CBS: Outgoing payment failed:', webhook.data.id);
        break;
        
      case 'wallet.address.not_found':
        console.log('🔍 CBS: Wallet address not found:', webhook.data);
        break;
        
      case 'wallet.address.web_monetization':
        console.log('💻 CBS: Web monetization payment:', webhook.data);
        break;
        
      case 'asset.liquidity_low':
      case 'peer.liquidity_low':
        console.log('⚠️ CBS: Low liquidity alert:', webhook.type);
        break;
        
      default:
        console.log(`❓ CBS: Unknown webhook type: ${webhook.type}`);
        // Still mark as processed since we don't want to retry unknown types
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
 * Credit book balance and create pending payment for AML screening with currency conversion
 * Enhanced with AIML fraud detection
 */
async function creditBookBalanceAndCreatePendingPayment(accountId: number, amount: number, currency: string, webhook: RafikiWebhookData, db: any) {
  try {
    // Start transaction
    await db.query('BEGIN');
    
    // Get current account details including currency
    const accountResult = await db.query(
      'SELECT * FROM accounts WHERE id = $1 FOR UPDATE',
      [accountId]
    );
    
    if (accountResult.rows.length === 0) {
      throw new Error(`Account ${accountId} not found`);
    }
    
    const account = accountResult.rows[0];
    const accountCurrency = account.currency;
    
    console.log(`💰 Processing payment: ${formatCurrencyAmount(amount, currency)} → Account ${accountId} (${accountCurrency})`);
    
    // === NEW: AIML FRAUD DETECTION === 
    // Extract receiver name for fraud checking
    const receiverName = extractReceiverName(webhook.data, account);
    let isPaymentBlocked = false;
    let blockReason = '';
    
    if (receiverName) {
      try {
        const aimlService = new AIMLBlockService(db);
        const blockCheck = await aimlService.checkPaymentAgainstBlockList(receiverName, webhook.data);
        
        if (blockCheck.isBlocked) {
          console.log(`🚫 AIML FRAUD DETECTION: Payment blocked for ${receiverName}`);
          
          // Rollback the current transaction first to prevent payment processing
          await db.query('ROLLBACK');
          
          // Record the blocked payment in a separate transaction (outside of payment processing)
          try {
            await aimlService.recordBlockedPayment(
              webhook.data.id,
              receiverName,
              amount,
              currency,
              blockCheck.reason || 'Unknown fraud match',
              blockCheck.matchedEntry?.id,
              { matchedTerm: blockCheck.matchedEntry?.name, accountId: accountId },
              webhook,
              accountId // Pass account ID for the new schema
            );
          } catch (recordError: any) {
            console.error('⚠️ Failed to record blocked payment (payment still blocked):', recordError.message);
          }
          
          isPaymentBlocked = true;
          blockReason = blockCheck.reason || 'Fraud detection match';
          
          console.log(`❌ Payment ${webhook.data.id} blocked and NOT processed due to fraud detection`);
          return;
        } else {
          console.log(`✅ AIML: Payment cleared for ${receiverName} - no fraud matches`);
        }
      } catch (aimlError: any) {
        console.error('⚠️ AIML fraud detection error (allowing payment to continue):', aimlError.message);
        // Continue with normal processing if AIML fails
      }
    } else {
      console.log('⚠️ AIML: No receiver name found for fraud checking');
    }
    // === END AIML FRAUD DETECTION ===
    
    // Variables for final amount and currency to credit
    let finalAmount = amount;
    let finalCurrency = currency;
    let conversionDetails = null;
    
    // Check if currency conversion is needed (USD payment to PKR account)
    if (needsCurrencyConversion(currency, accountCurrency)) {
      console.log(`💱 Currency conversion required: ${currency} → ${accountCurrency}`);
      
      const conversion = await convertUSDtoPKR(amount);
      finalAmount = conversion.convertedAmount;
      finalCurrency = conversion.convertedCurrency;
      conversionDetails = conversion;
      
      console.log(`✅ Converted ${formatCurrencyAmount(amount, currency)} to ${formatCurrencyAmount(finalAmount, finalCurrency)} at rate ${conversion.exchangeRate}`);
    } else {
      console.log(`✅ No conversion needed: Payment currency (${currency}) matches account currency (${accountCurrency})`);
    }
    
    const currentBookBalance = parseFloat(account.book_balance || account.balance || 0);
    const newBookBalance = currentBookBalance + finalAmount;
    
    // Update book balance only (available balance stays the same until AML approval)
    await db.query(
      'UPDATE accounts SET book_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBookBalance.toFixed(2), accountId]
    );
    
    // Calculate risk score (use original USD amount for international compliance)
    const riskScore = conversionDetails 
      ? calculateConversionRisk(amount, finalAmount)
      : calculateRiskScore(webhook.data);
    
    // Create pending payment record for AML screening with conversion details
    const pendingPaymentResult = await db.query(
      `INSERT INTO pending_payments (
        webhook_id, account_id, amount, currency, 
        original_amount, original_currency, conversion_rate,
        payment_reference, payment_source, sender_info, 
        risk_score, status, auto_approval_eligible
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        webhook.id,
        accountId,
        finalAmount.toFixed(2),
        finalCurrency,
        conversionDetails ? amount.toFixed(2) : null,
        conversionDetails ? currency : null,
        conversionDetails ? conversionDetails.exchangeRate : null,
        `RAFIKI-${webhook.data.id}`,
        `Incoming payment from Rafiki wallet: ${webhook.data.client || 'Unknown'}${conversionDetails ? ` (converted from ${formatCurrencyAmount(amount, currency)})` : ''}`,
        JSON.stringify({
          walletAddressId: webhook.data.walletAddressId,
          client: webhook.data.client,
          metadata: webhook.data.metadata,
          conversion: conversionDetails,
          aimlChecked: true,
          receiverName: receiverName || 'Unknown'
        }),
        riskScore,
        'PENDING',
        finalAmount < (finalCurrency === 'PKR' ? 250000 : 1000) // Auto-approve: <$1000 USD or <₨250k PKR
      ]
    );
    
    const pendingPaymentId = pendingPaymentResult.rows[0].id;
    
    // Create transaction record for book balance credit
    const transactionRef = `WH-${String(webhook.id).slice(-8)}-${Date.now()}`;
    await db.query(
      `INSERT INTO transactions (
        account_id, transaction_type, amount, currency, balance_after,
        original_amount, original_currency, conversion_rate,
        description, reference_number, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        accountId,
        'CREDIT_PENDING',
        finalAmount.toFixed(2), // Use converted amount
        finalCurrency, // Use converted currency
        newBookBalance.toFixed(2),
        conversionDetails ? amount.toFixed(2) : null, // Original amount
        conversionDetails ? currency : null, // Original currency
        conversionDetails ? conversionDetails.exchangeRate : null, // Conversion rate
        `Incoming payment from Rafiki (Pending AML): ${webhook.data.id}${conversionDetails ? ` - Converted from ${formatCurrencyAmount(amount, currency)} at rate ${conversionDetails.exchangeRate}` : ''}${receiverName ? ` | Receiver: ${receiverName}` : ''}`,
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

/**
 * Extract names for AIML fraud detection (both sender and receiver)
 */
function extractReceiverName(paymentData: any, account?: any): string | null {
  // PRIORITY 1: Explicit sender names (most likely to contain suspicious entities)
  const senderNames = [
    paymentData.metadata?.senderName,
    paymentData.metadata?.Name, // Capital N as used in demo sender
    paymentData.senderName,
    paymentData.sender?.name
  ];
  
  for (const name of senderNames) {
    if (name && typeof name === 'string' && name.trim().length > 0) {
      const cleanName = name.trim();
      if (cleanName.length > 2 && !cleanName.includes('http') && !cleanName.toLowerCase().includes('payment')) {
        console.log(`🔍 AIML: Found sender name for fraud check: ${cleanName}`);
        return cleanName;
      }
    }
  }
  
  // PRIORITY 2: Explicit receiver names  
  const receiverNames = [
    paymentData.receiverName,
    paymentData.receiver?.name,
    paymentData.metadata?.receiverName,
    account?.name,
    account?.customer?.name
  ];
  
  for (const name of receiverNames) {
    if (name && typeof name === 'string' && name.trim().length > 0) {
      const cleanName = name.trim();
      if (cleanName.length > 2 && !cleanName.includes('http') && !cleanName.toLowerCase().includes('payment')) {
        console.log(`🔍 AIML: Found receiver name for fraud check: ${cleanName}`);
        return cleanName;
      }
    }
  }
  
  // PRIORITY 3: Description fields (only if they look like names, not generic descriptions)
  const descriptions = [
    paymentData.metadata?.description,
    paymentData.description
  ];
  
  for (const desc of descriptions) {
    if (desc && typeof desc === 'string' && desc.trim().length > 0) {
      const cleanDesc = desc.trim();
      // Only use description if it looks like a name (contains spaces, proper capitalization, not too long)
      if (cleanDesc.length > 5 && cleanDesc.length < 50 && 
          !cleanDesc.includes('http') && 
          !cleanDesc.toLowerCase().includes('payment') &&
          !cleanDesc.toLowerCase().includes('transfer') &&
          !cleanDesc.toLowerCase().includes('bank') &&
          cleanDesc.split(' ').length >= 2 &&
          cleanDesc.split(' ').length <= 4) {
        console.log(`🔍 AIML: Found potential name in description for fraud check: ${cleanDesc}`);
        return cleanDesc;
      }
    }
  }
  
  console.log('⚠️ AIML: No suitable name found for fraud checking');
  return null;
}

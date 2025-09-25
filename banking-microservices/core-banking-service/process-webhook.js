#!/usr/bin/env node

/**
 * Manual webhook processing script
 * Usage: node process-webhook.js [webhook_id]
 */

const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'abl_cbs',
  port: 5434,
});

async function processWebhook(webhookId) {
  const client = await pool.connect();
  
  try {
    console.log(`🔄 Processing webhook ID: ${webhookId}`);
    
    // Fetch webhook data
    const webhookResult = await client.query(
      'SELECT * FROM webhooks WHERE id = $1',
      [webhookId]
    );
    
    if (webhookResult.rows.length === 0) {
      throw new Error(`Webhook ${webhookId} not found`);
    }
    
    const webhook = webhookResult.rows[0];
    console.log(`📋 Webhook type: ${webhook.webhook_type}`);
    console.log(`📋 Account ID: ${webhook.account_id}`);
    console.log(`📋 Payment amount: ${webhook.payment_amount} ${webhook.payment_currency}`);
    
    if (webhook.webhook_type === 'incoming_payment.completed' && webhook.account_id && webhook.payment_amount) {
      await processIncomingPayment(client, webhook);
    } else {
      console.log('⚠️ Not an incoming payment completion or missing required data');
    }
    
    console.log('✅ Webhook processing completed');
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error.message);
    
    // Update webhook status to error
    await client.query(
      'UPDATE webhooks SET status = $1, error_message = $2, processed_at = NOW() WHERE id = $3',
      ['error', error.message, webhookId]
    );
    
  } finally {
    client.release();
  }
}

async function processIncomingPayment(client, webhook) {
  console.log('💰 Processing incoming payment completion...');
  
  await client.query('BEGIN');
  
  try {
    const accountId = webhook.account_id;
    const amount = parseFloat(webhook.payment_amount);
    const currency = webhook.payment_currency || 'USD';
    
    // Get account details
    const accountResult = await client.query(
      'SELECT * FROM accounts WHERE id = $1 FOR UPDATE',
      [accountId]
    );
    
    if (accountResult.rows.length === 0) {
      throw new Error(`Account ${accountId} not found`);
    }
    
    const account = accountResult.rows[0];
    const accountCurrency = account.currency;
    
    console.log(`💰 Payment: ${amount} ${currency} → Account ${accountId} (${accountCurrency})`);
    
    // Variables for final amount and currency
    let finalAmount = amount;
    let finalCurrency = currency;
    let conversionDetails = null;
    
    // Check if currency conversion is needed (USD payment to PKR account)
    if (currency === 'USD' && accountCurrency === 'PKR') {
      console.log('💱 Currency conversion required: USD → PKR');
      
      // Use fallback rate for manual processing
      const exchangeRate = 278.50;
      finalAmount = parseFloat((amount * exchangeRate).toFixed(2));
      finalCurrency = 'PKR';
      
      conversionDetails = {
        originalAmount: amount,
        originalCurrency: currency,
        convertedAmount: finalAmount,
        convertedCurrency: finalCurrency,
        exchangeRate: exchangeRate,
        provider: 'Manual Processing',
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Converted $${amount} to ₨${finalAmount} at rate ${exchangeRate}`);
    }
    
    const currentBookBalance = parseFloat(account.book_balance || account.balance || 0);
    const newBookBalance = currentBookBalance + finalAmount;
    
    // Update book balance
    await client.query(
      'UPDATE accounts SET book_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBookBalance.toFixed(2), accountId]
    );
    
    // Calculate risk score
    const riskScore = finalAmount > 1000 ? 45 : 25;
    
    // Create pending payment record
    const pendingPaymentResult = await client.query(
      `INSERT INTO pending_payments (
        webhook_id, account_id, amount, currency, 
        original_amount, original_currency, conversion_rate,
        payment_reference, payment_source, sender_info, 
        risk_score, status, auto_approval_eligible, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()) RETURNING id`,
      [
        webhook.id,
        accountId,
        finalAmount.toFixed(2),
        finalCurrency,
        conversionDetails ? amount.toFixed(2) : null,
        conversionDetails ? currency : null,
        conversionDetails ? conversionDetails.exchangeRate : null,
        `RAFIKI-${webhook.data.id || webhook.id}`,
        `Incoming payment from Rafiki wallet (Manual Processing)${conversionDetails ? ` - Converted from $${amount}` : ''}`,
        JSON.stringify({
          walletAddressId: webhook.wallet_address_id,
          conversion: conversionDetails,
          manualProcessing: true,
          processedAt: new Date().toISOString()
        }),
        riskScore,
        'PENDING',
        finalAmount < (finalCurrency === 'PKR' ? 250000 : 1000)
      ]
    );
    
    const pendingPaymentId = pendingPaymentResult.rows[0].id;
    
    // Create transaction record
    const transactionRef = `WH-${String(webhook.id).slice(-8)}-${Date.now()}`;
    await client.query(
      `INSERT INTO transactions (
        account_id, transaction_type, amount, currency, balance_after,
        original_amount, original_currency, conversion_rate,
        description, reference_number, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        accountId,
        'CREDIT_PENDING',
        finalAmount.toFixed(2),
        finalCurrency,
        newBookBalance.toFixed(2),
        conversionDetails ? amount.toFixed(2) : null,
        conversionDetails ? currency : null,
        conversionDetails ? conversionDetails.exchangeRate : null,
        `Incoming payment from Rafiki (Pending AML) - Manual Processing${conversionDetails ? ` - Converted from $${amount} at rate ${conversionDetails.exchangeRate}` : ''}`,
        transactionRef,
        'PENDING'
      ]
    );
    
    // Update webhook status
    await client.query(
      'UPDATE webhooks SET status = $1, processed_at = NOW() WHERE id = $2',
      ['processed', webhook.id]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ Pending payment ${pendingPaymentId} created for AML screening`);
    console.log(`💳 Book balance updated: ₨${newBookBalance}, Transaction: ${transactionRef}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// Main execution
async function main() {
  const webhookId = process.argv[2];
  
  if (!webhookId) {
    console.error('Usage: node process-webhook.js [webhook_id]');
    process.exit(1);
  }
  
  try {
    await processWebhook(parseInt(webhookId));
    console.log('🎉 Webhook processing completed successfully!');
  } catch (error) {
    console.error('💥 Webhook processing failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

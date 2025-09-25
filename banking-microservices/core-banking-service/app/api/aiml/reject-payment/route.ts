import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';
import { createReversalPayment } from '@/lib/rafiki';

// POST - Reject payment and create reversal with proper money flow
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    
    const body = await request.json();
    const { 
      paymentId, 
      reason
    } = body;

    if (!paymentId || !reason) {
      return NextResponse.json(
        { 
          success: false, 
          error: { message: 'Missing required fields: paymentId, reason' } 
        },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    console.log('🚨 Processing AML payment rejection with proper reversal flow...');
    console.log('📋 Payment ID:', paymentId);
    console.log('📋 Rejection Reason:', reason);

    // Start transaction
    await db.query('BEGIN');

    try {
      // Step 1: Get the blocked payment and its webhook data
      const blockedPaymentResult = await db.query(`
        SELECT * FROM blocked_payments 
        WHERE id = $1
      `, [paymentId]);

      if (blockedPaymentResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: { message: 'Blocked payment not found' } },
          { status: 404 }
        );
      }

      const blockedPayment = blockedPaymentResult.rows[0];
      console.log('📋 Found blocked payment:', {
        id: blockedPayment.id,
        webhook_id: blockedPayment.webhook_id,
        account_id: blockedPayment.account_id,
        amount: blockedPayment.amount,
        currency: blockedPayment.currency
      });

      // Step 2: Get webhook data to extract sender information
      let webhookData = null;
      let senderWalletAddress = null;
      
      if (blockedPayment.webhook_id) {
        const webhookResult = await db.query(`
          SELECT * FROM webhooks 
          WHERE id = $1
        `, [blockedPayment.webhook_id]);

        if (webhookResult.rows.length > 0) {
          const webhook = webhookResult.rows[0];
          webhookData = webhook.data;
          
          // Extract sender wallet address from webhook metadata
          if (webhookData?.metadata?.senderWalletAddress) {
            senderWalletAddress = webhookData.metadata.senderWalletAddress;
            console.log('📋 Found sender wallet address:', senderWalletAddress);
          } else {
            console.log('⚠️ No sender wallet address in webhook metadata');
          }
        }
      }

      // Step 3: Get receiver account details
      const accountResult = await db.query(`
        SELECT * FROM accounts WHERE id = $1
      `, [blockedPayment.account_id]);

      if (accountResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: { message: 'Receiver account not found' } },
          { status: 404 }
        );
      }

      const receiverAccount = accountResult.rows[0];
      console.log('📋 Receiver account:', receiverAccount.name, receiverAccount.iban);

      // Step 4: CREDIT the payment to receiver's account first (simulate the payment arriving)
      console.log('💰 Step 1: Crediting payment to receiver account...');
      
      // Get current account balance first
      const accountBeforeCredit = await db.query(`
        SELECT available_balance FROM accounts WHERE id = $1
      `, [blockedPayment.account_id]);
      const balanceBeforeCredit = parseFloat(accountBeforeCredit.rows[0].available_balance || '0');
      const balanceAfterCredit = balanceBeforeCredit + parseFloat(blockedPayment.amount);
      
      await db.query(`
        UPDATE accounts 
        SET available_balance = available_balance + $1,
            book_balance = book_balance + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [blockedPayment.amount, blockedPayment.account_id]);

      // Create transaction record for the credit
      await db.query(`
        INSERT INTO transactions (
          account_id, amount, currency, transaction_type, status, 
          description, reference_number, balance_after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `, [
        blockedPayment.account_id,
        blockedPayment.amount,
        blockedPayment.currency,
        'CREDIT',
        'COMPLETED',
        `Payment received (webhook ${blockedPayment.webhook_id}) - To be reversed due to AML rejection`,
        `CREDIT-${blockedPayment.webhook_id}`,
        balanceAfterCredit
      ]);

      console.log('✅ Payment credited to receiver account');

      // Step 5: IMMEDIATELY DEBIT the same amount (preparing for reversal)
      console.log('💰 Step 2: Immediately debiting from receiver account for reversal...');
      
      const balanceAfterDebit = balanceAfterCredit - parseFloat(blockedPayment.amount);
      
      await db.query(`
        UPDATE accounts 
        SET available_balance = available_balance - $1,
            book_balance = book_balance - $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [blockedPayment.amount, blockedPayment.account_id]);

      // Create transaction record for the debit
      await db.query(`
        INSERT INTO transactions (
          account_id, amount, currency, transaction_type, status, 
          description, reference_number, balance_after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `, [
        blockedPayment.account_id,
        blockedPayment.amount,
        blockedPayment.currency,
        'DEBIT',
        'COMPLETED',
        `AML Rejection - Debiting for reversal to sender`,
        `DEBIT-REVERSAL-${blockedPayment.webhook_id}`,
        balanceAfterDebit
      ]);

      console.log('✅ Amount debited from receiver account for reversal');

      // Step 6: Update blocked payment status to REJECTED
      await db.query(`
        UPDATE blocked_payments 
        SET status = $1, 
            rejection_reason = $2,
            rejected_by = $3,
            rejected_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 
      `, ['REJECTED', reason, 'AML_OFFICER', paymentId]);

      console.log('✅ Blocked payment marked as REJECTED');

      // Step 7: Create reversal payment back to sender using Rafiki (if we have sender info)
      let reversalResult = null;
      
      if (senderWalletAddress) {
        try {
          console.log('💸 Step 3: Creating reversal payment to sender via Rafiki...');
          
          reversalResult = await createReversalPayment(
            senderWalletAddress,
            blockedPayment.amount.toString(),
            blockedPayment.currency,
            blockedPayment.webhook_id.toString(),
            `AML Rejection Reversal: ${reason}`,
            db,
            webhookData
          );

          console.log('✅ Reversal payment created successfully:', reversalResult.payment.id);

          // Update blocked payment with reversal information
          await db.query(`
            UPDATE blocked_payments 
            SET reversal_status = $1,
                reversal_payment_id = $2,
                reversal_amount = $3,
                reversal_currency = $4,
                reversal_recipient = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
          `, [
            'COMPLETED',
            reversalResult.payment.id,
            blockedPayment.amount,
            blockedPayment.currency,
            senderWalletAddress,
            paymentId
          ]);

        } catch (reversalError: any) {
          console.error('❌ Failed to create Rafiki reversal payment:', reversalError.message);
          
          // Mark reversal as failed but don't fail the whole transaction
          await db.query(`
            UPDATE blocked_payments 
            SET reversal_status = $1,
                reversal_error = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [
            'FAILED',
            reversalError.message,
            paymentId
          ]);

          reversalResult = {
            success: false,
            error: reversalError.message,
            payment: null
          };
        }
      } else {
        console.log('⚠️ No sender wallet address available - cannot create reversal payment');
        
        await db.query(`
          UPDATE blocked_payments 
          SET reversal_status = $1,
              reversal_error = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [
          'NO_SENDER_INFO',
          'Sender wallet address not available in webhook metadata',
          paymentId
        ]);
      }

      // Step 8: Create audit log entry
      await db.query(`
        INSERT INTO audit_logs (
          action,
          resource_type,
          resource_id,
          user_id,
          details,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        'PAYMENT_REJECTED_WITH_REVERSAL_FLOW',
        'blocked_payment',
        paymentId.toString(),
        'AML_OFFICER',
        JSON.stringify({
          rejectionReason: reason,
          paymentFlow: {
            step1: 'CREDITED_TO_RECEIVER',
            step2: 'DEBITED_FROM_RECEIVER', 
            step3: 'REVERSAL_PAYMENT_INITIATED'
          },
          reversalStatus: reversalResult?.success ? 'SUCCESS' : 'FAILED',
          reversalPaymentId: reversalResult?.payment?.id || null,
          senderWalletAddress: senderWalletAddress,
          processedAt: new Date().toISOString()
        })
      ]).catch(err => {
        console.error('⚠️ Failed to create audit log:', err);
      });

      await db.query('COMMIT');

      console.log('🎉 Payment rejection with reversal flow completed!');
      console.log('📊 Summary:');
      console.log('   ✅ Payment credited to receiver');
      console.log('   ✅ Payment debited from receiver');
      console.log('   ✅ Payment marked as rejected');
      console.log('   ' + (reversalResult?.success ? '✅' : '❌') + ' Reversal payment ' + (reversalResult?.success ? 'sent to sender' : 'failed'));

      return NextResponse.json({
        success: true,
        message: 'Payment rejected with complete reversal flow',
        data: {
          paymentFlow: {
            step1: 'Payment credited to receiver account',
            step2: 'Payment immediately debited from receiver account',
            step3: reversalResult?.success 
              ? 'Reversal payment sent to original sender' 
              : 'Reversal payment failed - manual intervention required'
          },
          reversal: reversalResult?.success ? {
            status: 'COMPLETED',
            paymentId: reversalResult.payment.id,
            amount: blockedPayment.amount,
            currency: blockedPayment.currency,
            recipient: senderWalletAddress
          } : {
            status: 'FAILED',
            error: reversalResult?.error || 'No sender information available'
          }
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('❌ Error processing payment rejection:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to process payment rejection with reversal flow',
          details: error?.message || 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

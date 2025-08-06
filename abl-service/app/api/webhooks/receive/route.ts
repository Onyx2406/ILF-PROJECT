import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { webhookStore, WebhookEvent } from '@/lib/webhooks-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📡 WEBHOOK RECEIVED:', {
      headers: Object.fromEntries(request.headers.entries()),
      body: body
    });

    // Create webhook event record
    const webhookEvent: WebhookEvent = {
      id: nanoid(),
      timestamp: new Date().toISOString(),
      type: body.type || 'unknown_event',
      data: body,
      walletAddressId: body.data?.walletAddressId || body.walletAddressId,
      accountId: body.data?.accountId || body.accountId,
      status: 'received'
    };

    // Store webhook using shared store
    webhookStore.addWebhook(webhookEvent);

    console.log('✅ WEBHOOK STORED:', {
      id: webhookEvent.id,
      type: webhookEvent.type,
      timestamp: webhookEvent.timestamp
    });

    // Process webhook based on type
    try {
      await processWebhook(webhookEvent);
      webhookEvent.status = 'processed';
    } catch (error) {
      console.error('❌ WEBHOOK PROCESSING ERROR:', error);
      webhookEvent.status = 'error';
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed',
      id: webhookEvent.id
    });

  } catch (error) {
    console.error('❌ WEBHOOK RECEIVE ERROR:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook'
    }, { status: 400 });
  }
}

async function processWebhook(webhook: WebhookEvent) {
  console.log('🔄 Processing webhook:', webhook.type);
  
  switch (webhook.type) {
    case 'wallet_address.created':
      console.log('👛 New wallet address created:', webhook.data.walletAddressId);
      break;
      
    case 'incoming_payment.created':
      console.log('💰 New incoming payment:', webhook.data.paymentId);
      break;
      
    case 'outgoing_payment.created':
      console.log('💸 New outgoing payment:', webhook.data.paymentId);
      break;
      
    case 'outgoing_payment.completed':
      console.log('✅ Outgoing payment completed:', webhook.data.paymentId);
      break;
      
    case 'outgoing_payment.failed':
      console.log('❌ Outgoing payment failed:', webhook.data.paymentId);
      break;
      
    default:
      console.log('❓ Unknown webhook type:', webhook.type);
  }
}

import { NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhooks-store';

export async function GET() {
  const webhooks = webhookStore.getWebhooks();
  console.log('📡 API: Getting webhooks, count:', webhooks.length);
  
  return NextResponse.json({
    success: true,
    webhooks: webhooks.slice().reverse(), // Most recent first
    count: webhooks.length
  });
}

export async function DELETE() {
  console.log('🗑️ API: Clearing all webhooks');
  webhookStore.clearWebhooks();
  
  return NextResponse.json({
    success: true,
    message: 'All webhooks cleared'
  });
}

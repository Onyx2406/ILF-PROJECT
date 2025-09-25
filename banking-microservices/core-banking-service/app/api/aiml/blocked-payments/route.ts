import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';
import { AIMLBlockService } from '@/lib/aiml-block-service';

// GET - Retrieve blocked payments
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabase();
    const aimlService = new AIMLBlockService(db);
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const blockedPayments = await aimlService.getBlockedPayments(limit, offset);

    return NextResponse.json({
      success: true,
      data: blockedPayments,
      total: blockedPayments.length,
      limit,
      offset
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error retrieving blocked payments:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to retrieve blocked payments' } },
      { status: 500 }
    );
  }
}

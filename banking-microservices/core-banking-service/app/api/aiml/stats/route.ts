import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';
import { AIMLBlockService } from '@/lib/aiml-block-service';

// GET - Retrieve AIML statistics
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabase();
    const aimlService = new AIMLBlockService(db);
    
    const stats = await aimlService.getBlockedPaymentsStats();

    return NextResponse.json({
      success: true,
      data: stats
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error retrieving AIML stats:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to retrieve statistics' } },
      { status: 500 }
    );
  }
}

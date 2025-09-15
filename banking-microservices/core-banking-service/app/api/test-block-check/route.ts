import { NextRequest, NextResponse } from 'next/server';
import { checkBlockList } from '@/lib/database';

// Test endpoint to verify block list checking
export async function POST(request: NextRequest) {
  try {
    const { senderName } = await request.json();
    
    if (!senderName) {
      return NextResponse.json(
        { success: false, error: 'senderName is required' },
        { status: 400 }
      );
    }

    const blockResult = await checkBlockList(senderName);
    
    return NextResponse.json({
      success: true,
      senderName,
      isBlocked: blockResult.isBlocked,
      blockReason: blockResult.blockReason,
      similarityScore: blockResult.similarityScore,
      matchedEntity: blockResult.matchedEntity
    });

  } catch (error: any) {
    console.error('❌ Error testing block check:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

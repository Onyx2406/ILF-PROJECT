import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';
import { AIMLBlockService } from '@/lib/aiml-block-service';

// GET - Retrieve block list entries
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabase();
    const aimlService = new AIMLBlockService(db);
    
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // Default to true

    const blockList = await aimlService.getBlockList(activeOnly);

    return NextResponse.json({
      success: true,
      data: blockList,
      total: blockList.length,
      activeOnly
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error retrieving block list:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to retrieve block list' } },
      { status: 500 }
    );
  }
}

// POST - Add new entry to block list
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabase();
    const aimlService = new AIMLBlockService(db);
    
    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.type || !data.reason) {
      return NextResponse.json(
        { success: false, error: { message: 'Name, type, and reason are required' } },
        { status: 400 }
      );
    }

    const id = await aimlService.addToBlockList(
      data.name,
      data.type,
      data.reason,
      data.severity || 'HIGH',
      data.addedBy || 'ADMIN',
      data.notes
    );

    return NextResponse.json({
      success: true,
      data: { id },
      message: `Added ${data.name} to block list`
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error adding to block list:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to add to block list' } },
      { status: 500 }
    );
  }
}

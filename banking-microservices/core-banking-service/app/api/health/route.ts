import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET() {
  try {
    // Test database connection
    const db = getDatabase();
    await db.query('SELECT NOW()');

    return NextResponse.json({
      service: 'ABL Core Banking Service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        service: 'ABL Core Banking Service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'disconnected',
        error: 'Database connection failed'
      },
      { status: 503 }
    );
  }
}

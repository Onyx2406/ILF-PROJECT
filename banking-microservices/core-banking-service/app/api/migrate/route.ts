import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

// POST - Run database migration to add currency conversion columns
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabase();
    
    const { action } = await request.json();
    
    console.log(`🔧 Running database migration: ${action || 'default'}...`);
    
    let migrations = [];
    
    if (action === 'add_transaction_conversion_columns') {
      // Add currency conversion columns to transactions table
      migrations = [
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2);',
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3);',
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(10,6);'
      ];
    } else {
      // Default: Add currency conversion columns to pending_payments table
      migrations = [
        'ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2);',
        'ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3);',
        'ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(10,6);'
      ];
    }
    
    const results = [];
    
    for (const migration of migrations) {
      try {
        await db.query(migration);
        results.push({ sql: migration, status: 'success' });
        console.log('✅ Migration executed:', migration);
      } catch (error: any) {
        results.push({ sql: migration, status: 'error', error: error.message });
        console.log('❌ Migration failed:', migration, error.message);
      }
    }
    
    // Verify the schema
    const tableName = action === 'add_transaction_conversion_columns' ? 'transactions' : 'pending_payments';
    console.log(`🔍 Verifying ${tableName} table schema...`);
    const schemaResult = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    console.log(`📊 Current ${tableName} schema:`, schemaResult.rows);
    
    return NextResponse.json({
      success: true,
      message: `Database migration completed for ${tableName}`,
      action,
      migrations: results,
      schema: schemaResult.rows
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Migration failed' } },
      { status: 500 }
    );
  }
}

// GET - Check current schema
export async function GET() {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabase();
    
    const schemaResult = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'pending_payments' 
      ORDER BY ordinal_position
    `);
    
    return NextResponse.json({
      success: true,
      schema: schemaResult.rows
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

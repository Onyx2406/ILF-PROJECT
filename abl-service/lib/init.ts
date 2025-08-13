import { initializeDatabase } from '@/lib/database';

// Initialize database on server startup
let isInitialized = false;

export async function ensureDatabaseInitialized() {
  if (!isInitialized) {
    try {
      await initializeDatabase();
      isInitialized = true;
      console.log('🎉 Database initialization completed');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      // Don't throw - let the app continue and retry on next request
    }
  }
}

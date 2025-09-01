const { DatabaseManager } = require('./src/main/build/database/DatabaseManager');
const { MessageSyncService } = require('./src/main/build/services/MessageSyncService');
const { DatabaseCleanup } = require('./src/main/build/services/DatabaseCleanup');

async function testEmergencyCleanup() {
  console.log('🚀 Testing emergency message cleanup...');
  
  try {
    // Initialize database
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    // Get message stats before cleanup
    const cleanup = new DatabaseCleanup(dbManager);
    const statsBefore = await cleanup.getDatabaseStats();
    console.log('📊 Database stats before cleanup:', statsBefore);
    
    if (statsBefore.totalMessages > 10000) {
      console.log('🚨 Emergency mode detected - too many messages!');
      
      // Run emergency cleanup
      const messageSyncService = new MessageSyncService(dbManager, null);
      const deletedCount = await messageSyncService.emergencyDuplicateCleanup();
      console.log(`🧹 Removed ${deletedCount} duplicate messages`);
      
      // Get stats after
      const statsAfter = await cleanup.getDatabaseStats();
      console.log('📊 Database stats after cleanup:', statsAfter);
      
      const reduction = statsBefore.totalMessages - statsAfter.totalMessages;
      console.log(`✅ Cleanup complete! Reduced message count by ${reduction} messages`);
    } else {
      console.log('✅ Message count is normal - no emergency cleanup needed');
    }
    
    await dbManager.close();
    
  } catch (error) {
    console.error('❌ Error during cleanup test:', error);
  }
}

testEmergencyCleanup();
import log from 'electron-log';
import { EventEmitter } from 'events';

export interface SyncState {
  isMessageSyncActive: boolean;
  isContactSyncActive: boolean;
  isCallLogSyncActive: boolean;
  lastMessageSync: Date | null;
  lastContactSync: Date | null;
  lastCallLogSync: Date | null;
  messageCount: number;
  syncLocks: Set<string>;
}

export class SyncCoordinator extends EventEmitter {
  private state: SyncState;
  private syncCooldowns: Map<string, number> = new Map();
  
  // Minimum cooldown periods (in milliseconds)
  private readonly COOLDOWN_PERIODS = {
    message_sync: 60000,      // 1 minute
    contact_sync: 300000,     // 5 minutes  
    call_log_sync: 120000,    // 2 minutes
    device_scan: 30000,       // 30 seconds
    notification_check: 10000 // 10 seconds
  };

  constructor() {
    super();
    this.state = {
      isMessageSyncActive: false,
      isContactSyncActive: false,
      isCallLogSyncActive: false,
      lastMessageSync: null,
      lastContactSync: null,
      lastCallLogSync: null,
      messageCount: 0,
      syncLocks: new Set()
    };
    
    log.info('🔄 SyncCoordinator initialized - controlling all sync operations');
  }

  /**
   * Request permission to start a sync operation
   */
  async requestSync(syncType: keyof typeof this.COOLDOWN_PERIODS): Promise<boolean> {
    const lockKey = `sync_${syncType}`;
    
    // Check if already locked
    if (this.state.syncLocks.has(lockKey)) {
      log.debug(`⏸️  Sync blocked - ${syncType} already in progress`);
      return false;
    }

    // Check cooldown period
    const lastSync = this.syncCooldowns.get(syncType);
    const now = Date.now();
    const cooldownPeriod = this.COOLDOWN_PERIODS[syncType];
    
    if (lastSync && (now - lastSync) < cooldownPeriod) {
      const remainingCooldown = Math.ceil((cooldownPeriod - (now - lastSync)) / 1000);
      log.debug(`❄️  Sync blocked - ${syncType} cooldown active (${remainingCooldown}s remaining)`);
      return false;
    }

    // Grant permission and lock
    this.state.syncLocks.add(lockKey);
    this.syncCooldowns.set(syncType, now);
    
    log.info(`✅ Sync permission granted for: ${syncType}`);
    this.emit('sync-started', syncType);
    return true;
  }

  /**
   * Release sync lock when operation completes
   */
  releaseSync(syncType: keyof typeof this.COOLDOWN_PERIODS): void {
    const lockKey = `sync_${syncType}`;
    this.state.syncLocks.delete(lockKey);
    
    // Update state based on sync type
    const now = new Date();
    switch (syncType) {
      case 'message_sync':
        this.state.isMessageSyncActive = false;
        this.state.lastMessageSync = now;
        break;
      case 'contact_sync':
        this.state.isContactSyncActive = false;
        this.state.lastContactSync = now;
        break;
      case 'call_log_sync':
        this.state.isCallLogSyncActive = false;
        this.state.lastCallLogSync = now;
        break;
    }
    
    log.info(`🔓 Sync completed and released: ${syncType}`);
    this.emit('sync-completed', syncType);
  }

  /**
   * Force release all locks (emergency use)
   */
  releaseAllSyncLocks(): void {
    this.state.syncLocks.clear();
    this.state.isMessageSyncActive = false;
    this.state.isContactSyncActive = false;
    this.state.isCallLogSyncActive = false;
    log.warn('🆘 All sync locks force-released');
  }

  /**
   * Check if any sync is currently active
   */
  isSyncActive(): boolean {
    return this.state.syncLocks.size > 0;
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.state };
  }

  /**
   * Update message count (used for monitoring duplication)
   */
  updateMessageCount(count: number): void {
    const previousCount = this.state.messageCount;
    this.state.messageCount = count;
    
    if (count > previousCount + 100) {
      log.warn(`⚠️  Message count jumped significantly: ${previousCount} → ${count} (diff: +${count - previousCount})`);
      this.emit('message-spike-detected', { previous: previousCount, current: count });
    }
  }

  /**
   * Check if we're in emergency mode (too many messages)
   */
  isEmergencyMode(): boolean {
    return this.state.messageCount > 10000;
  }

  /**
   * Set extended cooldowns during emergency
   */
  activateEmergencyMode(): void {
    log.error('🚨 EMERGENCY MODE ACTIVATED - Message count exceeds safe limits');
    
    // Extend all cooldowns by 10x
    Object.keys(this.COOLDOWN_PERIODS).forEach(key => {
      const typedKey = key as keyof typeof this.COOLDOWN_PERIODS;
      this.COOLDOWN_PERIODS[typedKey] *= 10;
    });
    
    // Force release all current locks
    this.releaseAllSyncLocks();
    
    this.emit('emergency-mode-activated');
  }

  /**
   * Restore normal operation
   */
  deactivateEmergencyMode(): void {
    log.info('✅ Emergency mode deactivated - restoring normal sync intervals');
    
    // Restore original cooldowns
    this.COOLDOWN_PERIODS.message_sync = 60000;
    this.COOLDOWN_PERIODS.contact_sync = 300000;
    this.COOLDOWN_PERIODS.call_log_sync = 120000;
    this.COOLDOWN_PERIODS.device_scan = 30000;
    this.COOLDOWN_PERIODS.notification_check = 10000;
    
    this.emit('emergency-mode-deactivated');
  }
}
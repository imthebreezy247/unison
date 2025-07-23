import { Notification } from 'electron';
import log from 'electron-log';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
}

export class NotificationManager {
  private enabled: boolean = true;

  constructor() {
    this.checkPermissions();
  }

  async initialize(): Promise<void> {
    log.info('Initializing NotificationManager');
    
    // Request notification permissions if needed
    if (process.platform === 'win32') {
      try {
        await this.requestPermissions();
        log.info('Notification permissions granted');
      } catch (error) {
        log.error('Failed to get notification permissions:', error);
      }
    }
  }

  private checkPermissions(): void {
    if (!Notification.isSupported()) {
      log.warn('System notifications are not supported');
      this.enabled = false;
      return;
    }

    log.info('System notifications are supported');
  }

  private async requestPermissions(): Promise<void> {
    // On Windows, we don't need to explicitly request permissions
    // Electron handles this automatically
    return Promise.resolve();
  }

  showNotification(options: NotificationOptions): void {
    if (!this.enabled) {
      log.debug('Notifications disabled, skipping notification');
      return;
    }

    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: options.icon,
        silent: options.silent || false,
        urgency: options.urgency || 'normal',
      });

      notification.show();

      notification.on('click', () => {
        log.info('Notification clicked:', options.title);
        // Focus the main window when notification is clicked
        // This will be handled by the main process
      });

      log.debug('Notification shown:', options.title);
    } catch (error) {
      log.error('Failed to show notification:', error);
    }
  }

  showDeviceConnected(deviceName: string): void {
    this.showNotification({
      title: 'Device Connected',
      body: `${deviceName} has been connected successfully`,
      urgency: 'normal',
    });
  }

  showDeviceDisconnected(deviceName: string): void {
    this.showNotification({
      title: 'Device Disconnected',
      body: `${deviceName} has been disconnected`,
      urgency: 'low',
    });
  }

  showSyncCompleted(deviceName: string, itemsSynced: number): void {
    this.showNotification({
      title: 'Sync Completed',
      body: `Successfully synced ${itemsSynced} items from ${deviceName}`,
      urgency: 'normal',
    });
  }

  showSyncError(deviceName: string, error: string): void {
    this.showNotification({
      title: 'Sync Error',
      body: `Failed to sync with ${deviceName}: ${error}`,
      urgency: 'critical',
    });
  }

  showNewMessage(contactName: string, messagePreview: string): void {
    this.showNotification({
      title: `New message from ${contactName}`,
      body: messagePreview,
      urgency: 'normal',
    });
  }

  showIncomingCall(contactName: string, phoneNumber: string): void {
    this.showNotification({
      title: 'Incoming Call',
      body: `${contactName} (${phoneNumber})`,
      urgency: 'critical',
    });
  }

  showMissedCall(contactName: string, phoneNumber: string): void {
    this.showNotification({
      title: 'Missed Call',
      body: `${contactName} (${phoneNumber})`,
      urgency: 'normal',
    });
  }

  showFileTransferCompleted(fileName: string, direction: 'import' | 'export'): void {
    const actionText = direction === 'import' ? 'imported from' : 'exported to';
    this.showNotification({
      title: 'File Transfer Completed',
      body: `${fileName} has been ${actionText} your device`,
      urgency: 'low',
    });
  }

  showFileTransferError(fileName: string, error: string): void {
    this.showNotification({
      title: 'File Transfer Error',
      body: `Failed to transfer ${fileName}: ${error}`,
      urgency: 'normal',
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    log.info(`Notifications ${enabled ? 'enabled' : 'disabled'}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isSupported(): boolean {
    return Notification.isSupported();
  }
}
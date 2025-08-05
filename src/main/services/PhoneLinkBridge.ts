import { exec, spawn } from 'child_process';
import { EventEmitter } from 'events';
import log from 'electron-log';
import * as path from 'path';
import { WindowsUIAutomation } from './WindowsUIAutomation';
import { PhoneLinkAccessibility } from './PhoneLinkAccessibility';
import { PhoneLinkNotificationMonitor } from './PhoneLinkNotificationMonitor';

export interface PhoneLinkMessage {
  from: string;
  content: string;
  timestamp: Date;
  source: 'phone_link';
  messageType?: 'sms' | 'imessage';
}

export class PhoneLinkBridge extends EventEmitter {
  private isRunning = false;
  private messageQueue: any[] = [];
  private monitorProcess: any = null;
  private isMonitoring = false;
  private uiAutomation: WindowsUIAutomation;
  private accessibility: PhoneLinkAccessibility;
  private notificationMonitor: PhoneLinkNotificationMonitor;

  constructor() {
    super();
    log.info('🔗 Initializing Phone Link Bridge...');
    this.uiAutomation = new WindowsUIAutomation();
    this.accessibility = new PhoneLinkAccessibility();
    this.notificationMonitor = new PhoneLinkNotificationMonitor();
    this.initialize();
    
    // Listen for accessibility events
    this.accessibility.on('ui-change', (data) => {
      log.info('📱 Phone Link UI changed:', data);
    });
    
    this.accessibility.on('message-count', (data) => {
      log.info('📊 Message count update:', data);
    });
    
    // Listen for incoming messages from notification monitor
    this.notificationMonitor.on('message-received', (message) => {
      log.info('📨 Message received via notification monitor:', message);
      this.emit('message-received', message);
    });
  }

  private async initialize() {
    try {
      // Start Phone Link in background
      await this.startPhoneLinkHidden();
      
      // Start monitoring for messages
      await this.startMessageMonitoring();
      
      log.info('✅ Phone Link Bridge initialized successfully');
    } catch (error) {
      log.error('❌ Failed to initialize Phone Link Bridge:', error);
    }
  }

  private async startPhoneLinkHidden(): Promise<void> {
    return new Promise((resolve, reject) => {
      log.info('📱 Starting Phone Link in background...');
      
      // Launch Phone Link minimized and hidden
      const command = 'powershell -WindowStyle Hidden -Command "Start-Process ms-phone: -WindowStyle Minimized"';
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          log.error('Failed to start Phone Link:', error);
          reject(error);
        } else {
          log.info('✅ Phone Link started in background');
          this.isRunning = true;
          
          // Give Phone Link time to initialize
          setTimeout(() => resolve(), 2000);
        }
      });
    });
  }

  private async startMessageMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    log.info('👂 Starting Phone Link message monitoring...');
    
    try {
      // Method 1: Start notification monitoring (most reliable for incoming messages)
      this.notificationMonitor.startMonitoring();
      
      // Method 2: Start accessibility monitoring (for UI changes)
      this.accessibility.startAccessibilityMonitoring();
      
      // Method 3: Monitor Windows notifications (backup)
      this.monitorWindowsNotifications();
      
      // Method 4: Poll for changes every 2 seconds
      this.startPolling();
      
      this.isMonitoring = true;
      log.info('✅ Message monitoring started');
    } catch (error) {
      log.error('❌ Failed to start message monitoring:', error);
    }
  }

  private monitorWindowsNotifications(): void {
    log.info('🔔 Setting up simplified Phone Link monitoring...');
    
    // Simplified PowerShell script - focus on Phone Link process detection
    const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
"@

try {
  Write-Output "MONITOR_READY"
  
  while($true) {
    try {
      # Check if Phone Link is running
      $phoneLink = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
      if ($phoneLink) {
        Write-Output "PHONE_LINK_RUNNING"
      } else {
        Write-Output "PHONE_LINK_STOPPED"
      }
    } catch {
      # Ignore errors and continue
    }
    
    Start-Sleep -Seconds 5
  }
} catch {
  Write-Output "SETUP_ERROR:$($_.Exception.Message)"
}
`;

    // Start PowerShell process
    const psProcess = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.monitorProcess = psProcess;

    psProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      
      if (output === 'MONITOR_READY') {
        log.info('✅ Phone Link monitoring ready');
      } else if (output === 'PHONE_LINK_RUNNING') {
        log.debug('📱 Phone Link is running');
      } else if (output === 'PHONE_LINK_STOPPED') {
        log.debug('⚠️  Phone Link stopped');
      } else if (output.startsWith('SETUP_ERROR:')) {
        log.error('PowerShell setup error:', output);
      }
    });

    psProcess.stderr?.on('data', (data: Buffer) => {
      log.debug('PowerShell stderr:', data.toString());
    });

    psProcess.on('close', (code) => {
      log.warn(`Notification monitor process exited with code ${code}`);
      this.isMonitoring = false;
      
      // Restart monitoring after a delay
      setTimeout(() => {
        if (this.isRunning) {
          this.monitorWindowsNotifications();
        }
      }, 5000);
    });
  }

  private startPolling(): void {
    // Alternative method: Check for Phone Link window changes
    setInterval(() => {
      if (this.isRunning) {
        this.checkForNewMessages();
      }
    }, 2000);
  }

  private processIncomingMessage(rawContent: string): void {
    try {
      const messageData = this.parsePhoneLinkNotification(rawContent);
      
      if (messageData) {
        log.info('📨 Message intercepted from Phone Link:', messageData);
        
        // Emit to UnisonX
        this.emit('message-received', messageData);
      }
    } catch (error) {
      log.error('Error processing incoming message:', error);
    }
  }

  private parsePhoneLinkNotification(content: string): PhoneLinkMessage | null {
    try {
      // Common Phone Link notification formats:
      // "Contact Name: Message content"
      // "Contact Name\nMessage content" 
      // "+1234567890: Message content"
      
      let match = content.match(/^(.+?):\s*(.+)$/s);
      
      if (!match) {
        // Try newline format
        match = content.match(/^(.+?)\n(.+)$/s);
      }
      
      if (match && match[2]?.trim()) {
        const from = match[1].trim();
        const messageContent = match[2].trim();
        
        // Skip if it looks like a system message
        if (messageContent.toLowerCase().includes('phone link') || 
            messageContent.toLowerCase().includes('notification')) {
          return null;
        }
        
        return {
          from: from,
          content: messageContent,
          timestamp: new Date(),
          source: 'phone_link',
          messageType: 'sms' // Default to SMS, could be enhanced to detect iMessage
        };
      }
    } catch (error) {
      log.debug('Error parsing notification:', error);
    }
    
    return null;
  }

  private async checkForNewMessages(): Promise<void> {
    // Alternative method: Check Phone Link's local storage or registry
    // This is a fallback if notification monitoring doesn't work
    try {
      // Could check:
      // %LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState
      // Registry entries
      // Or use Windows APIs to query Phone Link's state
    } catch (error) {
      log.debug('Error checking for new messages:', error);
    }
  }

  public async sendMessage(to: string, message: string): Promise<boolean> {
    log.info(`📤 FAST sending to ${to}: "${message}"`);
    
    if (!this.isRunning) {
      log.error('Phone Link is not running');
      return false;
    }

    try {
      // Method 1: Try Accessibility API (most reliable)
      log.info('🎯 Trying Accessibility API automation...');
      let success = await this.accessibility.sendMessageViaAccessibility(to, message);
      
      if (success) {
        log.info('✅ Accessibility API method worked!');
        
        // Remove from queue if it was queued
        this.messageQueue = this.messageQueue.filter(
          msg => !(msg.to === to && msg.message === message)
        );
        
        return true;
      }
      
      // Method 2: Try PowerShell (fallback)
      log.info('🚀 Trying PowerShell automation fallback...');
      success = await this.uiAutomation.sendMessageThroughPhoneLink(to, message);
      
      if (success) {
        log.info('✅ PowerShell method worked!');
        
        // Remove from queue if it was queued
        this.messageQueue = this.messageQueue.filter(
          msg => !(msg.to === to && msg.message === message)
        );
        
        return true;
      }
      
      // Method 3: Fallback to VBScript
      log.info('🔄 Trying VBScript fallback...');
      success = await this.uiAutomation.sendMessageViaVBScript(to, message);
      
      if (success) {
        log.info('✅ VBScript method worked!');
        
        // Remove from queue if it was queued
        this.messageQueue = this.messageQueue.filter(
          msg => !(msg.to === to && msg.message === message)
        );
        
        return true;
      }
      
      log.error('❌ All automation methods failed');
      
      // Add to queue for retry
      this.messageQueue.push({
        to,
        message,
        timestamp: new Date(),
        retryCount: 0
      });
      
      return false;
      
    } catch (error) {
      log.error('Failed to send message via Phone Link:', error);
      return false;
    }
  }

  public async isPhoneLinkRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      // Check for Phone Link process (PhoneExperienceHost.exe is the main Phone Link process)
      exec('tasklist /FI "IMAGENAME eq PhoneExperienceHost.exe" /FO CSV /NH', (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          const isRunning = stdout.includes('PhoneExperienceHost.exe');
          if (isRunning) {
            log.info('✅ Phone Link process detected');
          } else {
            log.debug('❌ Phone Link process not found');
          }
          resolve(isRunning);
        }
      });
    });
  }

  public async restartPhoneLink(): Promise<void> {
    log.info('🔄 Restarting Phone Link...');
    
    // Kill existing Phone Link process
    exec('taskkill /F /IM PhoneExperienceHost.exe', () => {
      // Wait a moment then restart
      setTimeout(async () => {
        await this.startPhoneLinkHidden();
      }, 2000);
    });
  }

  public getQueuedMessages(): any[] {
    return [...this.messageQueue];
  }

  public clearQueue(): void {
    this.messageQueue = [];
  }

  public async cleanup(): Promise<void> {
    log.info('🧹 Cleaning up Phone Link Bridge...');
    
    this.isRunning = false;
    this.isMonitoring = false;
    
    if (this.monitorProcess) {
      this.monitorProcess.kill();
      this.monitorProcess = null;
    }
    
    // Stop all monitoring
    this.notificationMonitor.stopMonitoring();
    this.accessibility.stopAccessibilityMonitoring();
    
    this.removeAllListeners();
  }
}
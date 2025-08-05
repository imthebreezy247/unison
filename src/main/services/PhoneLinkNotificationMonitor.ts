import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import log from 'electron-log';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export class PhoneLinkNotificationMonitor extends EventEmitter {
  private notificationDb: Database.Database | null = null;
  private lastCheckedTime: number = Date.now();
  private checkInterval: NodeJS.Timeout | null = null;
  private psMonitor: any = null;

  constructor() {
    super();
    this.initializeNotificationDb();
  }

  private initializeNotificationDb(): void {
    try {
      // Windows notification database path
      const notifDbPath = 'C:\\Users\\shann\\AppData\\Local\\Microsoft\\Windows\\Notifications\\wpndatabase.db';
      
      if (fs.existsSync(notifDbPath)) {
        // Make a copy to avoid locking issues
        const tempDbPath = path.join(process.env.TEMP || '', 'wpndatabase_copy.db');
        fs.copyFileSync(notifDbPath, tempDbPath);
        
        this.notificationDb = new Database(tempDbPath, { readonly: true });
        log.info('✅ Connected to Windows notification database');
      } else {
        log.warn('⚠️ Windows notification database not found');
      }
    } catch (error) {
      log.error('Failed to initialize notification database:', error);
    }
  }

  public startMonitoring(): void {
    log.info('🔔 Starting Phone Link notification monitoring...');
    
    // Method 1: PowerShell WMI event monitoring
    this.startWMIMonitoring();
    
    // Method 2: Poll notification database
    this.startDatabasePolling();
    
    // Method 3: Monitor Phone Link process for toast notifications
    this.startToastMonitoring();
  }

  private startWMIMonitoring(): void {
    const wmiScript = `
# Monitor for new Windows notifications
Register-WmiEvent -Query @"
SELECT * FROM __InstanceCreationEvent WITHIN 1
WHERE TargetInstance ISA 'Win32_Process'
AND TargetInstance.Name = 'RuntimeBroker.exe'
"@ -Action {
    Start-Sleep -Milliseconds 500
    
    # Check for Phone Link notifications
    try {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
using Windows.UI.Notifications;
using Windows.Data.Xml.Dom;

public class NotificationMonitor {
    public static void CheckNotifications() {
        try {
            var notificationManager = ToastNotificationManager.CreateToastNotifier("Microsoft.YourPhone_8wekyb3d8bbwe!App");
            var history = ToastNotificationManager.History;
            
            foreach (var notification in history.GetHistory("Microsoft.YourPhone_8wekyb3d8bbwe!App")) {
                var xml = notification.Content.GetXml();
                if (xml.Contains("message") || xml.Contains("SMS")) {
                    Console.WriteLine("NOTIFICATION:" + xml);
                }
            }
        } catch (Exception ex) {
            // Ignore errors
        }
    }
}
'@ -ReferencedAssemblies Windows.UI, Windows.Data
        
        [NotificationMonitor]::CheckNotifications()
    } catch {
        # Alternative method using PowerShell cmdlets
        $notifications = Get-WinEvent -FilterHashTable @{LogName='Microsoft-Windows-PushNotifications-Platform/Operational'; ID=1} -MaxEvents 10 -ErrorAction SilentlyContinue
        
        foreach ($event in $notifications) {
            $message = $event.Message
            if ($message -like "*YourPhone*" -or $message -like "*Phone Link*") {
                Write-Output "PHONE_LINK_NOTIFICATION:$message"
            }
        }
    }
}

Write-Output "WMI_MONITOR_STARTED"

# Keep the script running
while ($true) {
    Start-Sleep -Seconds 30
}
`;

    this.psMonitor = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', wmiScript], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.psMonitor.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      
      if (output.startsWith('NOTIFICATION:')) {
        const xmlContent = output.substring(13);
        this.parseNotificationXml(xmlContent);
      } else if (output.startsWith('PHONE_LINK_NOTIFICATION:')) {
        const message = output.substring(24);
        this.parsePhoneLinkNotification(message);
      } else if (output === 'WMI_MONITOR_STARTED') {
        log.info('✅ WMI notification monitor started');
      }
    });

    this.psMonitor.stderr?.on('data', (data: Buffer) => {
      log.debug('WMI monitor stderr:', data.toString());
    });
  }

  private startDatabasePolling(): void {
    if (!this.notificationDb) return;
    
    // Poll every 2 seconds
    this.checkInterval = setInterval(() => {
      this.checkNewNotifications();
    }, 2000);
  }

  private checkNewNotifications(): void {
    if (!this.notificationDb) return;
    
    try {
      // Query for recent Phone Link notifications
      const query = `
        SELECT * FROM Notification 
        WHERE AppId LIKE '%YourPhone%' 
        AND ArrivalTime > ?
        ORDER BY ArrivalTime DESC
      `;
      
      const notifications = this.notificationDb.prepare(query).all(this.lastCheckedTime) as any[];
      
      for (const notif of notifications) {
        if (notif.Payload) {
          this.parseNotificationPayload(notif.Payload);
        }
      }
      
      this.lastCheckedTime = Date.now();
    } catch (error) {
      // Database might be locked, ignore
    }
  }

  private startToastMonitoring(): void {
    const toastScript = `
Add-Type @'
using System;
using System.Diagnostics;
using System.Management;
using System.Text.RegularExpressions;

public class ToastMonitor {
    public static void Monitor() {
        var startInfo = new ProcessStartInfo {
            FileName = "powershell.exe",
            Arguments = "-Command \"Get-Process | Where-Object {$_.MainWindowTitle -like '*notification*' -or $_.MainWindowTitle -like '*Phone Link*'}\"",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            CreateNoWindow = true
        };
        
        while (true) {
            try {
                using (var process = Process.Start(startInfo)) {
                    string output = process.StandardOutput.ReadToEnd();
                    if (!string.IsNullOrEmpty(output)) {
                        Console.WriteLine("TOAST_CHECK:" + output);
                    }
                }
            } catch { }
            
            System.Threading.Thread.Sleep(1000);
        }
    }
}
'@

[ToastMonitor]::Monitor()
`;

    exec(`powershell.exe -ExecutionPolicy Bypass -Command "${toastScript}"`, (error, stdout) => {
      if (stdout) {
        log.debug('Toast monitor output:', stdout);
      }
    });
  }

  private parseNotificationXml(xml: string): void {
    try {
      // Extract message content from notification XML
      const textMatch = xml.match(/<text[^>]*>([^<]+)<\/text>/g);
      if (textMatch && textMatch.length >= 2) {
        const sender = textMatch[0].replace(/<\/?text[^>]*>/g, '');
        const message = textMatch[1].replace(/<\/?text[^>]*>/g, '');
        
        if (sender && message) {
          this.emit('message-received', {
            from: sender,
            content: message,
            timestamp: new Date(),
            source: 'phone_link_notification'
          });
          
          log.info(`📨 Intercepted Phone Link message from ${sender}: ${message}`);
        }
      }
    } catch (error) {
      log.debug('Error parsing notification XML:', error);
    }
  }

  private parsePhoneLinkNotification(message: string): void {
    // Parse Phone Link notification from event log
    const senderMatch = message.match(/From:\s*([^\n]+)/);
    const contentMatch = message.match(/Message:\s*(.+)/);
    
    if (senderMatch && contentMatch) {
      this.emit('message-received', {
        from: senderMatch[1].trim(),
        content: contentMatch[1].trim(),
        timestamp: new Date(),
        source: 'phone_link_notification'
      });
    }
  }

  private parseNotificationPayload(payload: any): void {
    try {
      // Parse binary payload or JSON
      let data;
      if (typeof payload === 'string') {
        data = JSON.parse(payload);
      } else {
        // Handle binary data
        data = payload.toString();
      }
      
      // Extract message information
      if (data.text && data.title) {
        this.emit('message-received', {
          from: data.title,
          content: data.text,
          timestamp: new Date(),
          source: 'phone_link_notification'
        });
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }

  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.psMonitor) {
      this.psMonitor.kill();
      this.psMonitor = null;
    }
    
    if (this.notificationDb) {
      this.notificationDb.close();
      this.notificationDb = null;
    }
    
    log.info('🛑 Stopped Phone Link notification monitoring');
  }
}
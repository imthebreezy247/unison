import { EventEmitter } from 'events';
import { exec } from 'child_process';
import log from 'electron-log';

export class PhoneLinkWindowsRT extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Use Windows Runtime APIs to interface with Phone Link directly
   */
  public async sendMessageViaWindowsRT(phoneNumber: string, message: string): Promise<boolean> {
    log.info(`📱 Attempting Windows Runtime API method for ${phoneNumber}`);

    const script = `
# Load Windows Runtime APIs
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.ApplicationModel.Core.CoreApplication,Windows.ApplicationModel.Core,ContentType=WindowsRuntime] | Out-Null
[Windows.UI.Core.CoreWindow,Windows.UI.Core,ContentType=WindowsRuntime] | Out-Null
[Windows.ApplicationModel.DataTransfer.DataPackage,Windows.ApplicationModel.DataTransfer,ContentType=WindowsRuntime] | Out-Null

try {
    # Method 1: Try using Windows.ApplicationModel.Chat API
    Write-Output "Attempting Windows Chat API..."
    
    Add-Type @"
using System;
using System.Runtime.InteropServices;
using Windows.ApplicationModel.Chat;
using Windows.Foundation;
using System.Threading.Tasks;

public class PhoneLinkChat {
    public static async Task<bool> SendSMS(string phoneNumber, string message) {
        try {
            var chatStore = await ChatMessageManager.RequestStoreAsync();
            var chatMessage = new ChatMessage();
            chatMessage.Body = message;
            chatMessage.Recipients.Add(phoneNumber);
            
            await chatStore.SendMessageAsync(chatMessage);
            Console.WriteLine("SMS_SENT_VIA_CHAT_API");
            return true;
        } catch (Exception ex) {
            Console.WriteLine("CHAT_API_ERROR: " + ex.Message);
            return false;
        }
    }
}
"@ -ReferencedAssemblies @(
    "C:\\Windows\\System32\\WinRT\\Windows.ApplicationModel.dll",
    "C:\\Windows\\System32\\WinRT\\Windows.Foundation.dll",
    "System.Runtime.WindowsRuntime.dll"
)
    
    # Try to send via Chat API
    $task = [PhoneLinkChat]::SendSMS("${phoneNumber}", "${message}")
    $task.Wait()
    
} catch {
    Write-Output "CHAT_API_FAILED: $($_.Exception.Message)"
}

# Method 2: Try using Windows.System.RemoteSystems API
try {
    Write-Output "Attempting Remote Systems API..."
    
    Add-Type @"
using System;
using Windows.System.RemoteSystems;
using Windows.Foundation;
using System.Threading.Tasks;

public class RemoteMessaging {
    public static async Task<bool> SendViaRemoteSystem(string phoneNumber, string message) {
        try {
            var watcher = RemoteSystem.CreateWatcher();
            var systems = new System.Collections.Generic.List<RemoteSystem>();
            
            watcher.RemoteSystemAdded += (s, args) => {
                systems.Add(args.RemoteSystem);
            };
            
            watcher.Start();
            await Task.Delay(2000);
            watcher.Stop();
            
            foreach (var system in systems) {
                if (system.DisplayName.Contains("iPhone") || system.Kind == "Phone") {
                    Console.WriteLine("FOUND_IPHONE: " + system.DisplayName);
                    
                    // Try to launch messaging app on remote system
                    var launchUri = new Uri($"sms:{phoneNumber}&body={Uri.EscapeDataString(message)}");
                    var request = new RemoteSystemConnectionRequest(system);
                    var result = await RemoteLauncher.LaunchUriAsync(request, launchUri);
                    
                    if (result == RemoteLaunchUriStatus.Success) {
                        Console.WriteLine("REMOTE_LAUNCH_SUCCESS");
                        return true;
                    }
                }
            }
            
            Console.WriteLine("NO_IPHONE_FOUND");
            return false;
        } catch (Exception ex) {
            Console.WriteLine("REMOTE_SYSTEM_ERROR: " + ex.Message);
            return false;
        }
    }
}
"@ -ReferencedAssemblies @(
    "C:\\Windows\\System32\\WinRT\\Windows.System.dll",
    "C:\\Windows\\System32\\WinRT\\Windows.Foundation.dll",
    "System.Runtime.WindowsRuntime.dll"
)

    $task = [RemoteMessaging]::SendViaRemoteSystem("${phoneNumber}", "${message}")
    $task.Wait()
    
} catch {
    Write-Output "REMOTE_SYSTEM_FAILED: $($_.Exception.Message)"
}

# Method 3: Direct Phone Link app protocol
try {
    Write-Output "Attempting Phone Link protocol..."
    
    # Try to use ms-phone protocol directly
    $uri = "ms-phone:?PhoneNumber=${phoneNumber}&Body=$([System.Uri]::EscapeDataString('${message}'))"
    Start-Process $uri
    Write-Output "PHONE_PROTOCOL_LAUNCHED"
    
} catch {
    Write-Output "PROTOCOL_FAILED: $($_.Exception.Message)"
}

# Method 4: Use Windows notification system to trigger Phone Link
try {
    Write-Output "Attempting notification trigger..."
    
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType=WindowsRuntime] | Out-Null
    
    $template = @"
<toast activationType="protocol" launch="ms-phone:">
    <visual>
        <binding template="ToastGeneric">
            <text>Send SMS</text>
            <text>To: ${phoneNumber}</text>
        </binding>
    </visual>
    <actions>
        <action content="Send" activationType="protocol" arguments="ms-phone:?PhoneNumber=${phoneNumber}&amp;Body=$([System.Web.HttpUtility]::UrlEncode('${message}'))" />
    </actions>
</toast>
"@
    
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)
    
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Microsoft.YourPhone_8wekyb3d8bbwe!App")
    $notifier.Show($toast)
    
    Write-Output "NOTIFICATION_SENT"
    
} catch {
    Write-Output "NOTIFICATION_FAILED: $($_.Exception.Message)"
}

Write-Output "WINRT_COMPLETE"
`;

    return new Promise((resolve) => {
      exec(`powershell.exe -ExecutionPolicy Bypass -Command "${script}"`, 
        { maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          log.info('🪟 Windows RT output:', stdout);
          if (stderr) {
            log.error('Windows RT stderr:', stderr);
          }
          
          const success = stdout.includes('SMS_SENT_VIA_CHAT_API') || 
                         stdout.includes('REMOTE_LAUNCH_SUCCESS') || 
                         stdout.includes('PHONE_PROTOCOL_LAUNCHED');
          
          resolve(success);
        }
      );
    });
  }

  /**
   * Use Windows 10/11 SMS relay feature
   */
  public async useSMSRelay(phoneNumber: string, message: string): Promise<boolean> {
    const relayScript = `
# Check if SMS relay is available
$smsRelay = Get-AppxPackage -Name Microsoft.Messaging

if ($smsRelay) {
    Write-Output "SMS_RELAY_AVAILABLE"
    
    # Try to launch Messaging app with pre-filled SMS
    $uri = "ms-chat:?ContactId=${phoneNumber}&Message=$([System.Uri]::EscapeDataString('${message}'))"
    Start-Process $uri
    
    Write-Output "MESSAGING_APP_LAUNCHED"
    
    # Also try direct SMS protocol
    $smsUri = "sms:${phoneNumber}?body=$([System.Uri]::EscapeDataString('${message}'))"
    Start-Process $smsUri
    
    Write-Output "SMS_PROTOCOL_LAUNCHED"
} else {
    Write-Output "SMS_RELAY_NOT_AVAILABLE"
}
`;

    return new Promise((resolve) => {
      exec(`powershell.exe -ExecutionPolicy Bypass -Command "${relayScript}"`,
        (error, stdout) => {
          log.info('📱 SMS Relay output:', stdout);
          resolve(stdout.includes('SMS_PROTOCOL_LAUNCHED'));
        }
      );
    });
  }
}
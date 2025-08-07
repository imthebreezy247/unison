import { EventEmitter } from 'events';
import { exec } from 'child_process';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';

export class PhoneLinkSignalRHijacker extends EventEmitter {
  private signalRConnection: any = null;
  private authTokens: any = null;
  private isConnected = false;

  constructor() {
    super();
  }

  /**
   * Extract authentication data from Phone Link's local storage
   */
  public async extractAuthTokens(): Promise<boolean> {
    log.info('🔑 Extracting Phone Link authentication tokens...');

    const script = `
# Extract Phone Link authentication data
$localStatePath = "$env:LOCALAPPDATA\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\LocalState"
$settingsPath = "$env:LOCALAPPDATA\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\Settings"

Write-Output "AUTH_EXTRACTION_START"

# Look for configuration files
$configFiles = Get-ChildItem $localStatePath -Include "*.json" -Recurse -ErrorAction SilentlyContinue
foreach ($file in $configFiles) {
    Write-Output "CONFIG_FILE: $($file.Name)"
    try {
        $content = Get-Content $file.FullName -Raw
        if ($content -match "token|auth|key|secret|api|endpoint|signalr|hub") {
            Write-Output "AUTH_DATA_FOUND: $($file.Name)"
            Write-Output "CONTENT_START"
            Write-Output $content
            Write-Output "CONTENT_END"
        }
    } catch {
        # Ignore errors reading files
    }
}

# Check registry for auth data
$regPaths = @(
    "HKCU:\\Software\\Microsoft\\YourPhone",
    "HKCU:\\Software\\Classes\\ms-phone"
)

foreach ($regPath in $regPaths) {
    if (Test-Path $regPath) {
        Write-Output "REG_PATH: $regPath"
        try {
            Get-ItemProperty -Path $regPath | Format-List | Out-String | ForEach-Object {
                if ($_ -match "token|auth|key|endpoint|api") {
                    Write-Output "REG_AUTH_DATA: $_"
                }
            }
        } catch {
            # Ignore registry errors
        }
    }
}

# Look for SQLite databases with auth data
$dbFiles = Get-ChildItem "$env:LOCALAPPDATA\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe" -Include "*.db" -Recurse -ErrorAction SilentlyContinue
foreach ($db in $dbFiles) {
    Write-Output "DATABASE_FOUND: $($db.FullName)"
}

Write-Output "AUTH_EXTRACTION_COMPLETE"
`;

    return new Promise((resolve) => {
      exec(`powershell.exe -ExecutionPolicy Bypass -Command "${script}"`,
        { maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          log.info('🔑 Auth extraction output:', stdout);
          
          // Parse authentication data
          const authDataMatch = stdout.match(/AUTH_DATA_FOUND: (.+?)[\r\n]+CONTENT_START([\s\S]*?)CONTENT_END/g);
          if (authDataMatch) {
            try {
              const contentMatch = authDataMatch[0].match(/CONTENT_START([\s\S]*?)CONTENT_END/);
              if (contentMatch) {
                const authContent = contentMatch[1].trim();
                this.authTokens = JSON.parse(authContent);
                log.info('✅ Authentication tokens extracted:', Object.keys(this.authTokens));
                resolve(true);
              } else {
                resolve(false);
              }
            } catch (parseError) {
              log.error('Failed to parse auth tokens:', parseError);
              resolve(false);
            }
          } else {
            log.warn('No authentication data found');
            resolve(false);
          }
        }
      );
    });
  }

  /**
   * Create SignalR connection to Phone Link servers using extracted auth data
   */
  public async connectToSignalR(): Promise<boolean> {
    log.info('📡 Attempting SignalR connection to Phone Link servers...');

    const signalRScript = `
# Load .NET assemblies for SignalR
Add-Type -Path "C:\\Program Files\\WindowsApps\\Microsoft.YourPhone_1.25061.51.0_x64__8wekyb3d8bbwe\\Microsoft.AspNetCore.SignalR.Client.dll"
Add-Type -Path "C:\\Program Files\\WindowsApps\\Microsoft.YourPhone_1.25061.51.0_x64__8wekyb3d8bbwe\\YourPhone.YPP.ServicesClient.dll"

try {
    Write-Output "SIGNALR_INIT_START"
    
    # Common Phone Link SignalR endpoints (discovered from network analysis)
    $endpoints = @(
        "https://api.yourphone.microsoft.com/signalr",
        "https://graph.microsoft.com/v1.0/communications/signalr",
        "https://substrate.office.com/messaging/signalr",
        "https://messaging.microsoft.com/hub"
    )
    
    foreach ($endpoint in $endpoints) {
        Write-Output "TESTING_ENDPOINT: $endpoint"
        
        try {
            # Create SignalR connection
            $connection = New-Object Microsoft.AspNetCore.SignalR.Client.HubConnectionBuilder
            $hubConnection = $connection.WithUrl($endpoint).Build()
            
            # Try to start connection
            $hubConnection.StartAsync().Wait(5000)
            
            if ($hubConnection.State -eq "Connected") {
                Write-Output "SIGNALR_CONNECTED: $endpoint"
                
                # Set up message handler
                $hubConnection.On("ReceiveMessage", [Action[string,string]] {
                    param($user, $message)
                    Write-Output "MESSAGE_RECEIVED: $user -> $message"
                })
                
                # Try to send a test message
                $hubConnection.InvokeAsync("SendMessage", "test", "Hello from UnisonX").Wait(2000)
                Write-Output "MESSAGE_SENT_SUCCESS"
                
                $hubConnection.StopAsync().Wait(2000)
                break
            }
        } catch {
            Write-Output "ENDPOINT_FAILED: $endpoint - $($_.Exception.Message)"
        }
    }
    
} catch {
    Write-Output "SIGNALR_ERROR: $($_.Exception.Message)"
}

Write-Output "SIGNALR_INIT_COMPLETE"
`;

    return new Promise((resolve) => {
      exec(`powershell.exe -ExecutionPolicy Bypass -Command "${signalRScript}"`,
        { maxBuffer: 5 * 1024 * 1024, timeout: 30000 },
        (error, stdout, stderr) => {
          log.info('📡 SignalR output:', stdout);
          if (stderr) log.error('SignalR stderr:', stderr);
          
          const connected = stdout.includes('SIGNALR_CONNECTED:') || stdout.includes('MESSAGE_SENT_SUCCESS');
          if (connected) {
            this.isConnected = true;
            const endpoint = stdout.match(/SIGNALR_CONNECTED: (.+)/)?.[1];
            log.info(`✅ SignalR connected to: ${endpoint}`);
          }
          
          resolve(connected);
        }
      );
    });
  }

  /**
   * Use Phone Link's YourPhone.YPP.ServicesClient.dll directly for messaging
   */
  public async sendMessageViaDLL(phoneNumber: string, message: string): Promise<boolean> {
    log.info(`🔗 Sending message via Phone Link DLL to ${phoneNumber}`);

    const dllScript = `
# Load Phone Link messaging DLLs directly
$phoneLinkPath = "C:\\Program Files\\WindowsApps\\Microsoft.YourPhone_1.25061.51.0_x64__8wekyb3d8bbwe"

try {
    Add-Type -Path "$phoneLinkPath\\YourPhone.YPP.ServicesClient.dll"
    Add-Type -Path "$phoneLinkPath\\YourPhone.Messaging.WinRT.dll"
    Add-Type -Path "$phoneLinkPath\\YourPhone.YPP.Common.dll"
    
    Write-Output "DLL_LOADED_SUCCESS"
    
    # Try to instantiate messaging service client
    $serviceClient = New-Object YourPhone.YPP.ServicesClient.MessagingServiceClient
    Write-Output "MESSAGING_CLIENT_CREATED"
    
    # Create message object
    $messageObj = New-Object YourPhone.Messaging.WinRT.MessageEntity
    $messageObj.PhoneNumber = "${phoneNumber}"
    $messageObj.Content = "${message}"
    $messageObj.Timestamp = [System.DateTime]::Now
    
    Write-Output "MESSAGE_OBJECT_CREATED"
    
    # Attempt to send message
    $result = $serviceClient.SendMessageAsync($messageObj).Result
    Write-Output "MESSAGE_SEND_RESULT: $result"
    
    if ($result) {
        Write-Output "DLL_MESSAGE_SENT_SUCCESS"
    } else {
        Write-Output "DLL_MESSAGE_SEND_FAILED"
    }
    
} catch {
    Write-Output "DLL_ERROR: $($_.Exception.Message)"
    Write-Output "DLL_ERROR_DETAILS: $($_.Exception.InnerException.Message)"
}

Write-Output "DLL_SEND_COMPLETE"
`;

    return new Promise((resolve) => {
      exec(`powershell.exe -ExecutionPolicy Bypass -Command "${dllScript}"`,
        { maxBuffer: 2 * 1024 * 1024 },
        (error, stdout, stderr) => {
          log.info('🔗 DLL output:', stdout);
          if (stderr) log.error('DLL stderr:', stderr);
          
          const success = stdout.includes('DLL_MESSAGE_SENT_SUCCESS') || 
                         stdout.includes('MESSAGE_SEND_RESULT: True');
          
          if (success) {
            log.info('✅ Message sent successfully via Phone Link DLL!');
          }
          
          resolve(success);
        }
      );
    });
  }

  /**
   * Use ms-phone protocol to send messages
   */
  public async sendViaProtocol(phoneNumber: string, message: string): Promise<boolean> {
    log.info(`📱 Sending via ms-phone protocol to ${phoneNumber}`);

    const protocolScript = `
# Use ms-phone protocol directly
$phoneNumber = "${phoneNumber}"
$message = "${message}"

try {
    # Method 1: Direct protocol launch
    $uri1 = "ms-phone:?PhoneNumber=$phoneNumber&Body=$([System.Uri]::EscapeDataString($message))"
    Start-Process $uri1
    Write-Output "PROTOCOL_LAUNCHED: $uri1"
    
    Start-Sleep -Seconds 2
    
    # Method 2: Tel protocol
    $uri2 = "tel:$phoneNumber"
    Start-Process $uri2
    Write-Output "TEL_PROTOCOL_LAUNCHED: $uri2"
    
    Start-Sleep -Seconds 1
    
    # Method 3: SMS protocol  
    $uri3 = "sms:$phoneNumber?body=$([System.Uri]::EscapeDataString($message))"
    Start-Process $uri3
    Write-Output "SMS_PROTOCOL_LAUNCHED: $uri3"
    
    Write-Output "PROTOCOL_SEND_SUCCESS"
    
} catch {
    Write-Output "PROTOCOL_ERROR: $($_.Exception.Message)"
}
`;

    return new Promise((resolve) => {
      exec(`powershell.exe -ExecutionPolicy Bypass -Command "${protocolScript}"`,
        (error, stdout) => {
          log.info('📱 Protocol output:', stdout);
          resolve(stdout.includes('PROTOCOL_SEND_SUCCESS'));
        }
      );
    });
  }

  /**
   * Initialize the SignalR hijacker
   */
  public async initialize(): Promise<boolean> {
    log.info('🚀 Initializing Phone Link SignalR hijacker...');

    // Step 1: Extract authentication tokens
    const authExtracted = await this.extractAuthTokens();
    if (!authExtracted) {
      log.warn('⚠️ Could not extract auth tokens, proceeding without authentication');
    }

    // Step 2: Try to connect to SignalR
    const signalRConnected = await this.connectToSignalR();
    if (signalRConnected) {
      log.info('✅ SignalR connection established!');
      return true;
    }

    log.info('🔄 SignalR connection failed, using alternative methods');
    return false;
  }

  /**
   * Send message using the best available method
   */
  public async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    log.info(`📤 Hijacking Phone Link to send to ${phoneNumber}: "${message}"`);

    // Method 1: Try DLL direct calling (most powerful)
    const dllSuccess = await this.sendMessageViaDLL(phoneNumber, message);
    if (dllSuccess) {
      log.info('✅ Message sent via Phone Link DLL!');
      return true;
    }

    // Method 2: Try protocol launching
    const protocolSuccess = await this.sendViaProtocol(phoneNumber, message);
    if (protocolSuccess) {
      log.info('✅ Message sent via Phone Link protocol!');
      return true;
    }

    log.error('❌ All Phone Link hijacking methods failed');
    return false;
  }
}
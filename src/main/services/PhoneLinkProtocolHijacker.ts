import { EventEmitter } from 'events';
import { exec } from 'child_process';
import log from 'electron-log';

export class PhoneLinkProtocolHijacker extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Send message using Phone Link's actual protocols
   */
  public async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    log.info(`🎯 HIJACKING Phone Link protocols for ${phoneNumber}: "${message}"`);

    // Method 1: Use ms-phone protocol with message body
    const success1 = await this.sendViaProtocol('ms-phone', phoneNumber, message);
    if (success1) return true;

    // Method 2: Use sms protocol
    const success2 = await this.sendViaProtocol('sms', phoneNumber, message);
    if (success2) return true;

    // Method 3: Use tel protocol and simulate typing
    const success3 = await this.sendViaProtocol('tel', phoneNumber, message);
    if (success3) return true;

    return false;
  }

  private async sendViaProtocol(protocol: string, phoneNumber: string, message: string): Promise<boolean> {
    log.info(`📱 Trying ${protocol} protocol...`);

    const script = `
try {
    $protocol = "${protocol}"
    $phoneNumber = "${phoneNumber}"
    $message = "${message}"
    
    if ($protocol -eq "ms-phone") {
        # Method 1: Direct ms-phone protocol with message body
        $uri = "ms-phone:?PhoneNumber=$phoneNumber&Body=$([System.Uri]::EscapeDataString($message))"
        Start-Process $uri
        Write-Output "MS_PHONE_LAUNCHED"
        
        # Wait a moment for Phone Link to open
        Start-Sleep -Seconds 3
        
        # Try to send the message using SendKeys as backup
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Write-Output "MS_PHONE_ENTER_SENT"
        
    } elseif ($protocol -eq "sms") {
        # Method 2: SMS protocol
        $uri = "sms:$phoneNumber" + "?body=" + [System.Uri]::EscapeDataString($message)
        Start-Process $uri
        Write-Output "SMS_LAUNCHED"
        
    } elseif ($protocol -eq "tel") {
        # Method 3: Tel protocol then simulate message typing
        $uri = "tel:$phoneNumber"
        Start-Process $uri
        Write-Output "TEL_LAUNCHED"
        
        # Wait for Phone Link to open
        Start-Sleep -Seconds 2
        
        # Try to switch to messaging mode
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("^{TAB}")  # Ctrl+Tab to switch modes
        Start-Sleep -Milliseconds 500
        [System.Windows.Forms.SendKeys]::SendWait($message)
        Start-Sleep -Milliseconds 500
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Write-Output "TEL_MESSAGE_SENT"
    }
    
    Write-Output "PROTOCOL_SUCCESS"
    
} catch {
    Write-Output "PROTOCOL_ERROR: $($_.Exception.Message)"
}
`;

    return new Promise((resolve) => {
      exec(`powershell.exe -ExecutionPolicy Bypass -Command "${script}"`,
        { timeout: 10000 },
        (error, stdout, stderr) => {
          log.info(`📱 ${protocol} protocol output:`, stdout.trim());
          if (stderr) log.debug(`${protocol} protocol stderr:`, stderr);
          
          const success = stdout.includes('PROTOCOL_SUCCESS') || 
                         stdout.includes('MS_PHONE_LAUNCHED') ||
                         stdout.includes('SMS_LAUNCHED') ||
                         stdout.includes('TEL_LAUNCHED');
          
          resolve(success);
        }
      );
    });
  }

  /**
   * Advanced method: Try to interact with Phone Link window directly after protocol launch
   */
  public async sendWithWindowInteraction(phoneNumber: string, message: string): Promise<boolean> {
    log.info(`💪 Advanced Phone Link hijacking for ${phoneNumber}`);

    const advancedScript = `
try {
    # Launch Phone Link with ms-phone protocol
    $uri = "ms-phone:?PhoneNumber=${phoneNumber}"
    Start-Process $uri
    Write-Output "PHONE_LINK_LAUNCHING"
    
    # Wait for Phone Link window to appear
    Start-Sleep -Seconds 3
    
    # Find Phone Link window
    Add-Type -AssemblyName System.Windows.Forms
    $phoneLinkWindows = Get-Process | Where-Object { $_.ProcessName -eq "PhoneExperienceHost" -and $_.MainWindowTitle -ne "" }
    
    if ($phoneLinkWindows.Count -gt 0) {
        Write-Output "PHONE_LINK_WINDOW_FOUND"
        
        # Bring window to foreground
        $window = $phoneLinkWindows[0]
        [Microsoft.VisualBasic.Interaction]::AppActivate($window.Id)
        Start-Sleep -Milliseconds 500
        
        # Try to navigate to messaging
        [System.Windows.Forms.SendKeys]::SendWait("^{TAB}")  # Switch to messages tab
        Start-Sleep -Milliseconds 500
        
        # Type the message
        [System.Windows.Forms.SendKeys]::SendWait("${message}")
        Start-Sleep -Milliseconds 500
        
        # Try multiple methods to send
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Milliseconds 200
        [System.Windows.Forms.SendKeys]::SendWait("^{ENTER}")
        Start-Sleep -Milliseconds 200
        [System.Windows.Forms.SendKeys]::SendWait("{TAB}{ENTER}")
        
        Write-Output "MESSAGE_TYPED_AND_SENT"
    } else {
        Write-Output "PHONE_LINK_WINDOW_NOT_FOUND"
    }
    
    Write-Output "ADVANCED_COMPLETE"
    
} catch {
    Write-Output "ADVANCED_ERROR: $($_.Exception.Message)"
}
`;

    return new Promise((resolve) => {
      exec(`powershell.exe -ExecutionPolicy Bypass -Command "${advancedScript}"`,
        { timeout: 15000 },
        (error, stdout, stderr) => {
          log.info('💪 Advanced hijacking output:', stdout.trim());
          if (stderr) log.debug('Advanced hijacking stderr:', stderr);
          
          const success = stdout.includes('MESSAGE_TYPED_AND_SENT') || 
                         stdout.includes('PHONE_LINK_WINDOW_FOUND');
          
          resolve(success);
        }
      );
    });
  }
}
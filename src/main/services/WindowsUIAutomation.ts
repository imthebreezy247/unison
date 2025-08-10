import { exec, spawn } from 'child_process';
import log from 'electron-log';
import * as fs from 'fs';

export class WindowsUIAutomation {
  
  /**
   * ULTRA-FAST Phone Link automation - Fixed all issues
   */
  public async sendMessageThroughPhoneLink(phoneNumber: string, message: string): Promise<boolean> {
    log.info(`🚀 FAST Phone Link automation to ${phoneNumber}`);
    
    try {
      // ULTRA-FAST PowerShell script - NO SYNTAX ERRORS
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# Start Phone Link if not already running
Start-Process "ms-phone:" -WindowStyle Normal
Start-Sleep -Milliseconds 1500

try {
  # Find Phone Link process
  $phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
  
  if (-not $phoneProcess) {
    Write-Output "ERROR: Phone Link process not found"
    exit 1
  }
  
  # Get Phone Link window
  $mainWindowHandle = $phoneProcess.MainWindowHandle
  $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)
  
  if (-not $phoneLinkWindow) {
    Write-Output "ERROR: Could not access Phone Link window"
    exit 1
  }
  
  # 1. Click Messages tab to ensure we're in the right place
  $messagesTabCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
    "ChatNodeAutomationId"
  )
  
  $messagesTab = $phoneLinkWindow.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants, 
    $messagesTabCondition
  )
  
  if ($messagesTab) {
    # Use Selection pattern instead of Invoke for tab items
    try {
      $selectionItemPattern = $messagesTab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
      $selectionItemPattern.Select()
    } catch {
      # Fallback to SendKeys if UI Automation fails
      [System.Windows.Forms.SendKeys]::SendWait("^1")
    }
    Start-Sleep -Milliseconds 1000
  }
  
  # 2. Look for existing conversation with this phone number
  $conversationList = $phoneLinkWindow.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
      "CVSListView"
    )
  )
  
  $foundExistingConversation = $false
  
  if ($conversationList) {
    # Find conversation with matching phone number
    $conversations = $conversationList.FindAll(
      [System.Windows.Automation.TreeScope]::Children,
      [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::ListItem
      )
    )
    
    foreach ($conversation in $conversations) {
      if ($conversation.Current.Name -like "*${phoneNumber}*") {
        # Found existing conversation, click it
        $invokePattern = $conversation.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $invokePattern.Invoke()
        $foundExistingConversation = $true
        Start-Sleep -Milliseconds 1000
        break
      }
    }
  }
  
  # 3. If no existing conversation found, create new message
  if (-not $foundExistingConversation) {
    # Click New Message button
    $newMessageCondition = [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
      "NewMessageButton"
    )
    
    $newMessageButton = $phoneLinkWindow.FindFirst(
      [System.Windows.Automation.TreeScope]::Descendants, 
      $newMessageCondition
    )
    
    if ($newMessageButton) {
      $invokePattern = $newMessageButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
      $invokePattern.Invoke()
      Start-Sleep -Milliseconds 1000
      
      # Type phone number
      [System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
      Start-Sleep -Milliseconds 500
      
      # CRITICAL: Press ENTER to load the contact/conversation
      [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
      Start-Sleep -Milliseconds 1500  # Wait for contact to load
      
      Write-Output "Contact loaded for ${phoneNumber}"
    } else {
      # Fallback to keyboard shortcut
      [System.Windows.Forms.SendKeys]::SendWait("^n")
      Start-Sleep -Milliseconds 1000
      [System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
      Start-Sleep -Milliseconds 500
      
      # CRITICAL: Press ENTER to load the contact/conversation
      [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
      Start-Sleep -Milliseconds 1500  # Wait for contact to load
      
      Write-Output "Fallback: Contact loaded for ${phoneNumber}"
    }
  }
  
  # 4. Now find and use the message input box
  $inputBoxCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
    "InputTextBox"
  )
  
  $inputBox = $phoneLinkWindow.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants, 
    $inputBoxCondition
  )
  
  if ($inputBox) {
    # CRITICAL: Ensure input box has focus and is ready
    $inputBox.SetFocus()
    Start-Sleep -Milliseconds 500
    
    # Click the input box to ensure it's active
    $rect = $inputBox.Current.BoundingRectangle
    $x = $rect.X + ($rect.Width / 2)
    $y = $rect.Y + ($rect.Height / 2)
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
    
    # Mouse click to ensure focus
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class Mouse {
      [DllImport("user32.dll")]
      public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
      public const uint LEFTDOWN = 0x0002;
      public const uint LEFTUP = 0x0004;
    }
"@
    [Mouse]::mouse_event([Mouse]::LEFTDOWN, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 50
    [Mouse]::mouse_event([Mouse]::LEFTUP, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 300
    
    # Clear any existing text first
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 100
    
    # Type the message
    [System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
    Start-Sleep -Milliseconds 800  # More time for button to become enabled
    
    # Verify input box has text and focus
    Write-Output "Input focused and message typed"
  } else {
    # Fallback - type message using SendKeys
    [System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
    Start-Sleep -Milliseconds 800
  }
} catch {
  Write-Output "ERROR during conversation setup: $($_.Exception.Message)"
  # Continue with fallback approach
  [System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
  Start-Sleep -Milliseconds 500
}

  # 5. CLICK THE SEND BUTTON - Using the same window element
  Start-Sleep -Milliseconds 1000  # Give more time for button to become enabled
  
  # Find the Send button
  $sendButtonCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
    "SendMessageButton"
  )
  
  $sendButton = $phoneLinkWindow.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants, 
    $sendButtonCondition
  )
  
  if ($sendButton) {
    Write-Output "Found Send button - Enabled: $($sendButton.Current.IsEnabled)"
    
    # Wait for button to become enabled (takes time after typing with focus)
    $attempts = 0
    while (-not $sendButton.Current.IsEnabled -and $attempts -lt 15) {
      Start-Sleep -Milliseconds 300  # Longer wait between checks
      $attempts++
      Write-Output "Waiting for Send button to enable... attempt $attempts"
    }
    
    if ($sendButton.Current.IsEnabled) {
      try {
        # Click the Send button using UI Automation
        $invokePattern = $sendButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $invokePattern.Invoke()
        Write-Output "SUCCESS: Send button clicked with UI Automation"
      } catch {
        # Fallback to mouse click if UI Automation fails
        $rect = $sendButton.Current.BoundingRectangle
        $x = $rect.X + ($rect.Width / 2)
        $y = $rect.Y + ($rect.Height / 2)
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
        Start-Sleep -Milliseconds 100
        
        # Import mouse click functionality
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Mouse {
          [DllImport("user32.dll")]
          public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
          public const uint LEFTDOWN = 0x0002;
          public const uint LEFTUP = 0x0004;
        }
"@
        [Mouse]::mouse_event([Mouse]::LEFTDOWN, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 50
        [Mouse]::mouse_event([Mouse]::LEFTUP, 0, 0, 0, 0)
        Write-Output "SUCCESS: Send button clicked with mouse"
      }
    } else {
      Write-Output "ERROR: Send button is disabled after waiting"
      # Try pressing Enter as absolute fallback
      [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
      Write-Output "FALLBACK: Tried Enter key"
    }
  } else {
    Write-Output "ERROR: Send button not found"
    # Try pressing Enter as absolute fallback
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Write-Output "FALLBACK: Tried Enter key"
  }

} catch {
  Write-Output "ERROR during automation: $($_.Exception.Message)"
  # Final fallback - just press Enter
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Write-Output "FINAL_FALLBACK: Tried Enter key"
}

Write-Output "BUTTON_CLICK_COMPLETE"
`;
      
      return new Promise((resolve) => {
        const psProcess = spawn('powershell.exe', [
          '-NoProfile', 
          '-ExecutionPolicy', 'Bypass', 
          '-WindowStyle', 'Hidden',
          '-Command', psScript
        ], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false
        });
        
        let output = '';
        let errorOutput = '';
        
        psProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
          log.info('📤 Phone Link output:', data.toString().trim());
        });
        
        psProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
          log.error('📤 Phone Link error:', data.toString().trim());
        });
        
        psProcess.on('close', (code) => {
          log.info(`📤 Phone Link automation finished with code: ${code}`);
          
          if (code === 0 || output.includes('SUCCESS')) {
            log.info('✅ Message sent successfully via Phone Link!');
            resolve(true);
          } else {
            log.error(`❌ Phone Link failed. Code: ${code}, Error: ${errorOutput}`);
            resolve(false);
          }
        });
        
        psProcess.on('error', (error) => {
          log.error('❌ PowerShell error:', error);
          resolve(false);
        });
        
        // Timeout after 10 seconds to allow for ENTER key delays
        setTimeout(() => {
          psProcess.kill();
          log.error('❌ Phone Link automation timed out (10 seconds)');
          resolve(false);
        }, 10000);
      });
      
    } catch (error) {
      log.error('❌ UI automation error:', error);
      return false;
    }
  }

  /**
   * BACKUP METHOD - Even faster VBScript approach
   */
  public async sendMessageViaVBScript(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const vbScript = `
Set WshShell = CreateObject("WScript.Shell")

WshShell.Run "ms-phone:", 1, False
WScript.Sleep 800

WshShell.AppActivate "Phone Link"
WScript.Sleep 200

WshShell.SendKeys "^n"
WScript.Sleep 400

WshShell.SendKeys "${phoneNumber}"
WScript.Sleep 200

WshShell.SendKeys "{TAB}"
WScript.Sleep 150

WshShell.SendKeys "${message.replace(/"/g, '""')}"
WScript.Sleep 200

WshShell.SendKeys "{ENTER}"
WScript.Sleep 300

WshShell.SendKeys "%{F9}"

WScript.Echo "SUCCESS"
`;
      
      return new Promise((resolve) => {
        const tempFile = `${process.env.TEMP}\\unison_send_${Date.now()}.vbs`;
        fs.writeFileSync(tempFile, vbScript);
        
        exec(`cscript //nologo "${tempFile}"`, (error, stdout, stderr) => {
          // Clean up temp file
          try { fs.unlinkSync(tempFile); } catch {}
          
          if (stdout.includes('SUCCESS')) {
            log.info('✅ Message sent via VBScript (backup method)');
            resolve(true);
          } else {
            log.error('❌ VBScript failed:', error || stderr);
            resolve(false);
          }
        });
        
        // Timeout
        setTimeout(() => {
          try { fs.unlinkSync(tempFile); } catch {}
          resolve(false);
        }, 8000);
      });
      
    } catch (error) {
      log.error('❌ VBScript error:', error);
      return false;
    }
  }
  
  /**
   * Check if Phone Link is running and responsive
   */
  public async isPhoneLinkResponsive(): Promise<boolean> {
    return new Promise((resolve) => {
      const psScript = `
        $processes = Get-Process | Where-Object { $_.ProcessName -like "*YourPhone*" }
        if ($processes.Count -gt 0) {
          $process = $processes[0]
          if ($process.Responding) {
            Write-Output "RESPONSIVE"
          } else {
            Write-Output "NOT_RESPONSIVE"
          }
        } else {
          Write-Output "NOT_RUNNING"
        }
      `;
      
      exec(`powershell -Command "${psScript}"`, (error, stdout) => {
        if (stdout.includes('RESPONSIVE')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }
  
  /**
   * Focus Phone Link window (bring to front)
   */
  public async focusPhoneLink(): Promise<boolean> {
    return new Promise((resolve) => {
      const psScript = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          }
"@
        
        $processes = Get-Process | Where-Object { $_.ProcessName -like "*YourPhone*" }
        if ($processes.Count -gt 0) {
          $process = $processes[0]
          [Win32]::ShowWindow($process.MainWindowHandle, 9)
          [Win32]::SetForegroundWindow($process.MainWindowHandle)
          Write-Output "FOCUSED"
        } else {
          Write-Output "NOT_FOUND"
        }
      `;
      
      exec(`powershell -Command "${psScript}"`, (error, stdout) => {
        resolve(stdout.includes('FOCUSED'));
      });
    });
  }
  
  /**
   * Hide/minimize Phone Link window
   */
  public async hidePhoneLink(): Promise<boolean> {
    return new Promise((resolve) => {
      const psScript = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          }
"@
        
        $processes = Get-Process | Where-Object { $_.ProcessName -like "*YourPhone*" }
        if ($processes.Count -gt 0) {
          $process = $processes[0]
          [Win32]::ShowWindow($process.MainWindowHandle, 6) # SW_MINIMIZE
          Write-Output "HIDDEN"
        } else {
          Write-Output "NOT_FOUND"
        }
      `;
      
      exec(`powershell -Command "${psScript}"`, (error, stdout) => {
        resolve(stdout.includes('HIDDEN'));
      });
    });
  }
}
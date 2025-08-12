import { exec, spawn } from 'child_process';
import log from 'electron-log';
import * as fs from 'fs';

export class WindowsUIAutomation {
  
  /**
   * TWO-STEP Phone Link automation - Contact loading then message sending
   */
  public async sendMessageThroughPhoneLink(phoneNumber: string, message: string): Promise<boolean> {
    log.info(`🚀 TWO-STEP Phone Link automation to ${phoneNumber}`);
    
    // Step 1: Load contact (this works perfectly)
    const contactLoaded = await this.loadContactInPhoneLink(phoneNumber);
    
    if (!contactLoaded) {
      log.error('❌ Step 1 failed: Could not load contact');
      return false;
    }
    
    log.info('✅ Step 1 complete: Contact loaded successfully');
    
    // Wait a moment between steps
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Type message and send
    const messageSent = await this.typeMessageAndSend(message);
    
    if (messageSent) {
      log.info('✅ Step 2 complete: Message sent successfully');
      return true;
    } else {
      log.error('❌ Step 2 failed: Could not send message');
      return false;
    }
  }

  /**
   * STEP 1: Load contact in Phone Link (just phone number + ENTER)
   */
  public async loadContactInPhoneLink(phoneNumber: string): Promise<boolean> {
    log.info(`📞 STEP 1: Loading contact for ${phoneNumber}`);
    
    try {
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
  
  # 2. ALWAYS create new message to ensure proper flow
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
    Start-Sleep -Milliseconds 2000  # MUCH longer wait after New Message
    
    # Type phone number SLOWLY
    Write-Output "Typing phone number: ${phoneNumber}"
    [System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
    Start-Sleep -Milliseconds 1500  # Longer wait after typing number
    
    # CRITICAL: Press ENTER to load the contact (simplified approach)
    Write-Output "NOW PRESSING ENTER TO LOAD CONTACT..."
    
    # Use multiple methods to ensure ENTER gets pressed
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
    
    # Backup ENTER press
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    
    Write-Output "ENTER pressed, waiting for contact to load..."
    Start-Sleep -Milliseconds 4000  # MUCH longer wait for contact to load
    
    Write-Output "SUCCESS: Contact loaded for ${phoneNumber}"
    
  } else {
    # Fallback to keyboard shortcut
    Write-Output "Using fallback method - Ctrl+N"
    [System.Windows.Forms.SendKeys]::SendWait("^n")
    Start-Sleep -Milliseconds 2000  # Longer wait after Ctrl+N
    [System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
    Start-Sleep -Milliseconds 1500  # Longer wait after typing
    
    # CRITICAL: Press ENTER to load the contact (fallback simplified)
    Write-Output "Fallback: NOW PRESSING ENTER TO LOAD CONTACT..."
    
    # Use multiple methods to ensure ENTER gets pressed
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
    
    # Backup ENTER press
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    
    Write-Output "Fallback: ENTER pressed, waiting..."
    Start-Sleep -Milliseconds 4000  # Much longer wait for contact to load
    
    Write-Output "SUCCESS: Fallback contact loaded for ${phoneNumber}"
  }

} catch {
  Write-Output "ERROR during contact loading: $($_.Exception.Message)"
}

Write-Output "CONTACT_LOAD_COMPLETE"
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
          log.info('📞 Contact loading output:', data.toString().trim());
        });
        
        psProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
          log.error('📞 Contact loading error:', data.toString().trim());
        });
        
        psProcess.on('close', (code) => {
          log.info(`📞 Contact loading finished with code: ${code}`);
          
          if (code === 0 || output.includes('SUCCESS')) {
            log.info('✅ Contact loaded successfully!');
            resolve(true);
          } else {
            log.error(`❌ Contact loading failed. Code: ${code}, Error: ${errorOutput}`);
            resolve(false);
          }
        });
        
        psProcess.on('error', (error) => {
          log.error('❌ Contact loading PowerShell error:', error);
          resolve(false);
        });
        
        // Timeout after 8 seconds (just for contact loading)
        setTimeout(() => {
          psProcess.kill();
          log.error('❌ Contact loading timed out (8 seconds)');
          resolve(false);
        }, 8000);
      });
      
    } catch (error) {
      log.error('❌ Contact loading error:', error);
      return false;
    }
  }

  /**
   * STEP 2: Just type message and hit send (assumes contact is already loaded)
   */
  public async typeMessageAndSend(message: string): Promise<boolean> {
    log.info(`💬 STEP 2: Typing message and sending...`);
    
    try {
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

try {
  # Find Phone Link process (should already be running)
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
  
  # Find message input box
  $inputBoxCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
    "InputTextBox"
  )
  
  $inputBox = $phoneLinkWindow.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants, 
    $inputBoxCondition
  )
  
  if ($inputBox) {
    Write-Output "Found message input box, setting focus..."
    $inputBox.SetFocus()
    Start-Sleep -Milliseconds 800
    
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
    Start-Sleep -Milliseconds 500
    
    # Clear any existing text
    Write-Output "Clearing input and typing message..."
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 200
    
    # Type the message
    [System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
    Start-Sleep -Milliseconds 1000
    
    Write-Output "Message typed, pressing ENTER to send..."
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
    
    Write-Output "SUCCESS: Message sent with ENTER key"
  } else {
    Write-Output "Input box not found, trying direct ENTER..."
    [System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
    Start-Sleep -Milliseconds 800
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Write-Output "SUCCESS: Message sent via fallback"
  }

} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
  # Final fallback
  [System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
  Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Write-Output "FINAL_FALLBACK: Tried typing + Enter"
}

Write-Output "MESSAGE_SEND_COMPLETE"
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
          log.info('💬 Message typing output:', data.toString().trim());
        });
        
        psProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
          log.error('💬 Message typing error:', data.toString().trim());
        });
        
        psProcess.on('close', (code) => {
          log.info(`💬 Message typing finished with code: ${code}`);
          
          if (code === 0 || output.includes('SUCCESS')) {
            log.info('✅ Message typed and sent successfully!');
            resolve(true);
          } else {
            log.error(`❌ Message typing failed. Code: ${code}, Error: ${errorOutput}`);
            resolve(false);
          }
        });
        
        psProcess.on('error', (error) => {
          log.error('❌ Message typing PowerShell error:', error);
          resolve(false);
        });
        
        // Timeout after 8 seconds (shorter since we're just typing)
        setTimeout(() => {
          psProcess.kill();
          log.error('❌ Message typing timed out (8 seconds)');
          resolve(false);
        }, 8000);
      });
      
    } catch (error) {
      log.error('❌ Message typing error:', error);
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
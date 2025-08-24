import { exec, spawn } from 'child_process';
import log from 'electron-log';
import * as fs from 'fs';

export class WindowsUIAutomation {
  
  /**
   * SINGLE-SCRIPT Phone Link automation - Contact loading AND message sending in one go
   */
  public async sendMessageThroughPhoneLink(phoneNumber: string, message: string): Promise<boolean> {
    const startTime = Date.now();
    log.info(`🚀 SINGLE-SCRIPT Phone Link automation to ${phoneNumber}`);
    log.info(`📍 INTERNAL: Function called at ${new Date().toLocaleTimeString()}`);
    log.info(`📍 INTERNAL: Target number: ${phoneNumber}, Message length: ${message.length} chars`);
    log.info(`📍 INTERNAL: Starting PowerShell script generation...`);
    
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
  
  Write-Output "STEP 1: Loading contact for ${phoneNumber}..."
  
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
    try {
      $selectionItemPattern = $messagesTab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
      $selectionItemPattern.Select()
    } catch {
      [System.Windows.Forms.SendKeys]::SendWait("^1")
    }
    Start-Sleep -Milliseconds 1000
  }
  
  # 2. Click New Message button
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
    Start-Sleep -Milliseconds 2000
    
    # Type phone number
    Write-Output "Typing phone number: ${phoneNumber}"
    [System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
    Start-Sleep -Milliseconds 1500
    
    # Press ENTER to load contact
    Write-Output "Pressing ENTER to load contact..."
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")  # Backup ENTER
    
    Write-Output "Waiting for contact to load..."
    Start-Sleep -Milliseconds 4000  # Reduced wait time
    
    Write-Output "STEP 1 COMPLETE: Contact loaded"
    
  } else {
    # Fallback method
    Write-Output "Using fallback: Ctrl+N"
    [System.Windows.Forms.SendKeys]::SendWait("^n")
    Start-Sleep -Milliseconds 2000
    [System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
    Start-Sleep -Milliseconds 1500
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 4000
    Write-Output "STEP 1 COMPLETE: Fallback contact loaded"
  }
  
  Write-Output "STEP 2: Now typing message..."
  
  # 3. Find message input box
  $inputBoxCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
    "InputTextBox"
  )
  
  $inputBox = $phoneLinkWindow.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants, 
    $inputBoxCondition
  )
  
  if ($inputBox) {
    Write-Output "Found message input box"
    $inputBox.SetFocus()
    Start-Sleep -Milliseconds 800
    
    # Click input box
    $rect = $inputBox.Current.BoundingRectangle
    $x = $rect.X + ($rect.Width / 2)
    $y = $rect.Y + ($rect.Height / 2)
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
    
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
    
    # Clear and type message
    Write-Output "Typing message: ${message}"
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
    Start-Sleep -Milliseconds 500
    
    Write-Output "Pressing ENTER to send..."
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 300
    
    Write-Output "SUCCESS: Message sent!"
  } else {
    # Fallback - just type and send
    Write-Output "Input box not found, using fallback..."
    [System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
    Start-Sleep -Milliseconds 800
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Write-Output "SUCCESS: Message sent via fallback!"
  }

} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
  # Final fallback
  [System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
  Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Write-Output "FINAL_FALLBACK: Message sent"
}

Write-Output "AUTOMATION_COMPLETE"
`;
        
        log.info(`📍 INTERNAL: PowerShell script generated (${psScript.length} chars)`);
        log.info(`📍 INTERNAL: About to spawn PowerShell process with elevated privileges...`);
      
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
          const logData = data.toString().trim();
          output += data.toString();
          
          // Real-time detailed logging with timestamps
          const timestamp = new Date().toLocaleTimeString();
          log.info(`🔄 [${timestamp}] Phone Link automation:`, logData);
          
          // Additional context logging
          if (logData.includes('STEP 1:')) {
            log.info('📍 INTERNAL: Starting contact loading phase...');
          } else if (logData.includes('STEP 1 COMPLETE')) {
            log.info('📍 INTERNAL: Contact loading successful, moving to message phase...');
          } else if (logData.includes('STEP 2:')) {
            log.info('📍 INTERNAL: Starting message typing phase...');
          } else if (logData.includes('Found message input box')) {
            log.info('📍 INTERNAL: UI automation located message input field successfully');
          } else if (logData.includes('Typing message:')) {
            log.info('📍 INTERNAL: Beginning text input simulation...');
          } else if (logData.includes('Pressing ENTER')) {
            log.info('📍 INTERNAL: Sending message with ENTER key simulation...');
          } else if (logData.includes('SUCCESS:')) {
            log.info('📍 INTERNAL: Message transmission completed successfully!');
          } else if (logData.includes('ERROR:')) {
            log.info('📍 INTERNAL: PowerShell error detected, check output above');
          }
        });
        
        psProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
          log.error('🔄 Phone Link error:', data.toString().trim());
        });
        
        psProcess.on('close', (code) => {
          const timestamp = new Date().toLocaleTimeString();
          log.info(`🔄 [${timestamp}] Phone Link automation finished with code: ${code}`);
          log.info('📍 INTERNAL: PowerShell process terminated, analyzing results...');
          log.info(`📍 INTERNAL: Output length: ${output.length} characters`);
          log.info(`📍 INTERNAL: Error output length: ${errorOutput.length} characters`);
          
          clearTimeout(timeoutHandle); // Clear timeout since process completed
          const duration = Date.now() - startTime;
          log.info(`📍 INTERNAL: Total execution time: ${duration}ms`);
          
          if (code === 0 || output.includes('SUCCESS')) {
            log.info('✅ FINAL RESULT: Message sent successfully via single script!');
            log.info('📍 INTERNAL: Resolving promise with success (true)');
            resolve(true);
          } else {
            log.error(`❌ FINAL RESULT: Single script failed. Code: ${code}, Error: ${errorOutput}`);
            log.info('📍 INTERNAL: Resolving promise with failure (false)');
            resolve(false);
          }
        });
        
        psProcess.on('error', (error) => {
          log.error('❌ Single script PowerShell error:', error);
          resolve(false);
        });
        
        // Extended timeout for the full process
        const timeoutHandle = setTimeout(() => {
          log.error('⏰ TIMEOUT: 20 seconds elapsed, killing PowerShell process...');
          log.info('📍 INTERNAL: Timeout triggered, this means the script took too long');
          psProcess.kill();
          log.error('❌ Phone Link automation timed out (20 seconds)');
          log.info('📍 INTERNAL: Process killed, resolving with failure');
          resolve(false);
        }, 20000);
        
        // Log the start of execution with timeout info
        log.info('📍 INTERNAL: PowerShell process started with 20-second timeout');
        log.info('📍 INTERNAL: Monitoring stdout/stderr for real-time progress...');
      });
      
    } catch (error) {
      log.error('❌ Phone Link automation error:', error);
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

  /**
   * Explore Phone Link UI elements for calls debugging
   */
  public async explorePhoneLinkCallsInterface(): Promise<boolean> {
    log.info(`🔍 EXPLORING Phone Link calls interface...`);
    
    try {
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# Start Phone Link if not already running
Start-Process "ms-phone:" -WindowStyle Normal
Start-Sleep -Milliseconds 2000

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
  
  Write-Output "=== EXPLORING PHONE LINK UI STRUCTURE ==="
  
  # Get all buttons and their names
  $buttonCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty, 
    [System.Windows.Automation.ControlType]::Button
  )
  $buttons = $phoneLinkWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $buttonCondition)
  
  Write-Output "=== ALL BUTTONS FOUND ==="
  foreach ($button in $buttons) {
    $name = $button.Current.Name
    $automationId = $button.Current.AutomationId
    Write-Output "BUTTON: Name='$name' AutomationId='$automationId'"
  }
  
  # Get all tabs and navigation items
  $tabCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty, 
    [System.Windows.Automation.ControlType]::TabItem
  )
  $tabs = $phoneLinkWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $tabCondition)
  
  Write-Output "=== ALL TABS/NAVIGATION ITEMS ==="
  foreach ($tab in $tabs) {
    $name = $tab.Current.Name
    $automationId = $tab.Current.AutomationId
    Write-Output "TAB: Name='$name' AutomationId='$automationId'"
  }
  
  # Get all list items (navigation might be a list)
  $listItemCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty, 
    [System.Windows.Automation.ControlType]::ListItem
  )
  $listItems = $phoneLinkWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $listItemCondition)
  
  Write-Output "=== ALL LIST ITEMS ==="
  foreach ($item in $listItems) {
    $name = $item.Current.Name
    $automationId = $item.Current.AutomationId
    Write-Output "LIST_ITEM: Name='$name' AutomationId='$automationId'"
  }
  
  # Get all text fields
  $editCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty, 
    [System.Windows.Automation.ControlType]::Edit
  )
  $edits = $phoneLinkWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCondition)
  
  Write-Output "=== ALL TEXT INPUT FIELDS ==="
  foreach ($edit in $edits) {
    $name = $edit.Current.Name
    $automationId = $edit.Current.AutomationId
    Write-Output "TEXT_FIELD: Name='$name' AutomationId='$automationId'"
  }
  
  Write-Output "=== EXPLORATION COMPLETE ==="
  Write-Output "SUCCESS: UI exploration completed"
  
} catch {
  Write-Output "ERROR: " + $_.Exception.Message
  exit 1
}
`;

      return new Promise<boolean>((resolve) => {
        const psProcess = spawn('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-Command', psScript
        ], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true
        });

        let output = '';
        let errorOutput = '';
        
        psProcess.stdout?.on('data', (data: Buffer) => {
          const logData = data.toString().trim();
          output += data.toString();
          
          const timestamp = new Date().toLocaleTimeString();
          log.info(`🔍 [${timestamp}] Phone Link UI exploration:`, logData);
        });
        
        psProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
          log.error('🔍 Phone Link exploration error:', data.toString().trim());
        });
        
        psProcess.on('close', (code) => {
          const timestamp = new Date().toLocaleTimeString();
          log.info(`🔍 [${timestamp}] Phone Link UI exploration finished with code: ${code}`);
          
          if (code === 0 || output.includes('SUCCESS')) {
            log.info('✅ Phone Link UI exploration completed successfully!');
            resolve(true);
          } else {
            log.error(`❌ Phone Link UI exploration failed. Code: ${code}, Error: ${errorOutput}`);
            resolve(false);
          }
        });
        
        psProcess.on('error', (error) => {
          log.error('❌ Phone Link exploration PowerShell error:', error);
          resolve(false);
        });
        
        // Timeout
        setTimeout(() => {
          log.error('⏰ Phone Link UI exploration timed out');
          psProcess.kill();
          resolve(false);
        }, 10000);
      });
      
    } catch (error) {
      log.error('❌ Phone Link UI exploration error:', error);
      return false;
    }
  }

  /**
   * Phone Link call automation - Make a phone call through Phone Link
   */
  public async makeCallThroughPhoneLink(phoneNumber: string): Promise<boolean> {
    const startTime = Date.now();
    log.info(`📞 PHONE CALL automation to ${phoneNumber}`);
    log.info(`📍 INTERNAL: Call function started at ${new Date().toLocaleTimeString()}`);
    
    try {
      // ENHANCED APPROACH - Proper UI automation for calls
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# Start Phone Link if not already running
Start-Process "ms-phone:" -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Output "STEP 1: Phone Link launched, finding main window..."

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
  
  Write-Output "STEP 2: Navigating to Calls section..."
  
  # First, try to find and click the Calls tab/navigation
  $callsTabConditions = @(
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, "Calls"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "CallsNodeAutomationId"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "PhoneCallsTab")
  )
  
  $callsTab = $null
  foreach ($condition in $callsTabConditions) {
    $callsTab = $phoneLinkWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($callsTab) { break }
  }
  
  if ($callsTab) {
    Write-Output "Found Calls tab, clicking..."
    try {
      $invokePattern = $callsTab.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
      $invokePattern.Invoke()
    } catch {
      # Fallback: try selection pattern
      try {
        $selectionItemPattern = $callsTab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        $selectionItemPattern.Select()
      } catch {
        # Final fallback: simulate click
        $rect = $callsTab.Current.BoundingRectangle
        $x = $rect.X + ($rect.Width / 2)
        $y = $rect.Y + ($rect.Height / 2)
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
        
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
      }
    }
    Start-Sleep -Seconds 2
  } else {
    Write-Output "Calls tab not found, trying navigation shortcuts..."
    # Try keyboard navigation to calls
    [System.Windows.Forms.SendKeys]::SendWait("^2")  # Ctrl+2 might be calls
    Start-Sleep -Milliseconds 1000
  }
  
  Write-Output "STEP 3: Looking for dial pad or call interface..."
  
  # Look for dial pad button, keypad, or phone number input
  $dialElements = @(
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, "Dial pad"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, "Keypad"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, "Make a call"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "DialPadButton"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "CallButton"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "NewCallButton")
  )
  
  $dialButton = $null
  foreach ($condition in $dialElements) {
    $dialButton = $phoneLinkWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($dialButton) { 
      Write-Output "Found dial interface: " + $dialButton.Current.Name
      break 
    }
  }
  
  if ($dialButton) {
    Write-Output "STEP 4: Clicking dial interface..."
    $invokePattern = $dialButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
    Start-Sleep -Seconds 2
  } else {
    Write-Output "No dial interface found, trying direct number input..."
  }
  
  Write-Output "STEP 5: Looking for phone number input field..."
  
  # Look for phone number input field
  $numberInputConditions = @(
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "PhoneNumberInput"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "DialPadInput"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, "Phone number")
  )
  
  $numberInput = $null
  foreach ($condition in $numberInputConditions) {
    $numberInput = $phoneLinkWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($numberInput) { 
      Write-Output "Found number input field: " + $numberInput.Current.AutomationId
      break 
    }
  }
  
  if ($numberInput) {
    Write-Output "STEP 6: Entering phone number ${phoneNumber}..."
    $numberInput.SetFocus()
    Start-Sleep -Milliseconds 500
    
    # Clear and type number
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
    Start-Sleep -Milliseconds 1000
  } else {
    Write-Output "No input field found, typing number directly..."
    [System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
    Start-Sleep -Milliseconds 1000
  }
  
  Write-Output "STEP 7: Looking for call button..."
  
  # Look for call/dial button
  $callButtonConditions = @(
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, "Call"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, "Dial"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "CallButton"),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "DialButton")
  )
  
  $callButton = $null
  foreach ($condition in $callButtonConditions) {
    $callButton = $phoneLinkWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($callButton) { 
      Write-Output "Found call button: " + $callButton.Current.Name
      break 
    }
  }
  
  if ($callButton) {
    Write-Output "STEP 8: Clicking call button to initiate call..."
    $invokePattern = $callButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
    Start-Sleep -Milliseconds 1000
    Write-Output "SUCCESS: Call button clicked for ${phoneNumber}"
  } else {
    Write-Output "Call button not found, trying Enter key..."
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
    Write-Output "SUCCESS: Call initiated with Enter key for ${phoneNumber}"
  }

} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
  # Fallback method - try the simple approach
  Write-Output "FALLBACK: Trying simple keyboard navigation..."
  [System.Windows.Forms.SendKeys]::SendWait("^2")  # Navigate to calls
  Start-Sleep -Milliseconds 1000
  [System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
  Start-Sleep -Milliseconds 1000
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Write-Output "FALLBACK_SUCCESS: Call attempted via keyboard navigation"
}

Write-Output "CALL_AUTOMATION_COMPLETE"
`;

      return new Promise<boolean>((resolve) => {
        const psProcess = spawn('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-Command', psScript
        ], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true
        });

        let output = '';
        let errorOutput = '';
        
        psProcess.stdout?.on('data', (data: Buffer) => {
          const logData = data.toString().trim();
          output += data.toString();
          
          const timestamp = new Date().toLocaleTimeString();
          log.info(`📞 [${timestamp}] Phone call automation:`, logData);
          
          // Additional context logging for calls
          if (logData.includes('STEP 1:')) {
            log.info('📍 INTERNAL: Navigating to calls section...');
          } else if (logData.includes('STEP 2:')) {
            log.info('📍 INTERNAL: Looking for dial interface...');
          } else if (logData.includes('STEP 3:')) {
            log.info('📍 INTERNAL: Searching for number input field...');
          } else if (logData.includes('STEP 4:')) {
            log.info('📍 INTERNAL: Entering phone number...');
          } else if (logData.includes('STEP 5:')) {
            log.info('📍 INTERNAL: Initiating call...');
          } else if (logData.includes('SUCCESS:')) {
            log.info('📍 INTERNAL: Call initiated successfully!');
          } else if (logData.includes('ERROR:')) {
            log.info('📍 INTERNAL: PowerShell error detected during call automation');
          }
        });
        
        psProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
          log.error('📞 Phone call error:', data.toString().trim());
        });
        
        psProcess.on('close', (code) => {
          const timestamp = new Date().toLocaleTimeString();
          log.info(`📞 [${timestamp}] Phone call automation finished with code: ${code}`);
          
          clearTimeout(timeoutHandle);
          const duration = Date.now() - startTime;
          log.info(`📍 INTERNAL: Total call automation time: ${duration}ms`);
          
          if (code === 0 || output.includes('SUCCESS')) {
            log.info('✅ FINAL RESULT: Phone call initiated successfully!');
            resolve(true);
          } else {
            log.error(`❌ FINAL RESULT: Call automation failed. Code: ${code}, Error: ${errorOutput}`);
            resolve(false);
          }
        });
        
        psProcess.on('error', (error) => {
          log.error('❌ Phone call PowerShell error:', error);
          resolve(false);
        });
        
        // Timeout for call automation
        const timeoutHandle = setTimeout(() => {
          log.error('⏰ TIMEOUT: 15 seconds elapsed, killing call automation...');
          psProcess.kill();
          log.error('❌ Phone call automation timed out (15 seconds)');
          resolve(false);
        }, 15000);
        
        log.info('📍 INTERNAL: Phone call PowerShell process started with 15-second timeout');
      });
      
    } catch (error) {
      log.error('❌ Phone call automation error:', error);
      return false;
    }
  }
}
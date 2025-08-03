import { exec, spawn } from 'child_process';
import log from 'electron-log';

export class WindowsUIAutomation {
  
  /**
   * Send a message through Phone Link using PowerShell UI automation
   */
  public async sendMessageThroughPhoneLink(phoneNumber: string, message: string): Promise<boolean> {
    log.info(`🤖 Automating Phone Link to send message to ${phoneNumber}`);
    
    try {
      // PowerShell script for UI automation
      const psScript = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          using System.Windows.Forms;
          using System.Threading;
        "@
        
        # Function to send keys
        function Send-Keys {
          param([string]$keys)
          [System.Windows.Forms.SendKeys]::SendWait($keys)
          Start-Sleep -Milliseconds 100
        }
        
        # Function to find and activate Phone Link window
        function Activate-PhoneLink {
          $processes = Get-Process | Where-Object { $_.ProcessName -like "*YourPhone*" -or $_.MainWindowTitle -like "*Phone Link*" }
          
          if ($processes.Count -eq 0) {
            # Start Phone Link if not running
            Start-Process "ms-phone:"
            Start-Sleep -Seconds 3
            $processes = Get-Process | Where-Object { $_.ProcessName -like "*YourPhone*" -or $_.MainWindowTitle -like "*Phone Link*" }
          }
          
          if ($processes.Count -gt 0) {
            $process = $processes[0]
            
            # Bring window to front
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
            
            [Win32]::ShowWindow($process.MainWindowHandle, 9) # SW_RESTORE
            [Win32]::SetForegroundWindow($process.MainWindowHandle)
            Start-Sleep -Milliseconds 500
            return $true
          }
          return $false
        }
        
        try {
          # Activate Phone Link
          $activated = Activate-PhoneLink
          if (-not $activated) {
            Write-Output "ERROR:Could not activate Phone Link"
            exit 1
          }
          
          # Try Ctrl+N for new message
          Send-Keys "^n"
          Start-Sleep -Seconds 1
          
          # Type phone number
          Send-Keys "${phoneNumber}"
          Start-Sleep -Milliseconds 500
          
          # Tab to message field
          Send-Keys "{TAB}"
          Start-Sleep -Milliseconds 300
          
          # Type message (escape special characters)
          $escapedMessage = "${message}" -replace '[+^%~(){}]', '{$&}'
          Send-Keys $escapedMessage
          Start-Sleep -Milliseconds 500
          
          # Send message (Enter)
          Send-Keys "{ENTER}"
          Start-Sleep -Milliseconds 500
          
          # Minimize Phone Link
          Send-Keys "%{F9}" # Alt+F9 or use minimize
          
          Write-Output "SUCCESS:Message sent successfully"
          
        } catch {
          Write-Output "ERROR:$($_.Exception.Message)"
        }
      `;
      
      return new Promise((resolve, reject) => {
        const psProcess = spawn('powershell', [
          '-NoProfile', 
          '-ExecutionPolicy', 'Bypass', 
          '-Command', psScript
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        psProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        psProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
        
        psProcess.on('close', (code) => {
          if (output.includes('SUCCESS:')) {
            log.info('✅ Message sent successfully via Phone Link automation');
            resolve(true);
          } else if (output.includes('ERROR:')) {
            const error = output.split('ERROR:')[1]?.trim() || 'Unknown error';
            log.error('❌ Phone Link automation error:', error);
            resolve(false);
          } else {
            log.error('❌ Phone Link automation failed:', errorOutput || 'Unknown error');
            resolve(false);
          }
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
          psProcess.kill();
          log.error('❌ Phone Link automation timed out');
          resolve(false);
        }, 30000);
      });
      
    } catch (error) {
      log.error('❌ UI automation error:', error);
      return false;
    }
  }
  
  /**
   * Alternative method using Windows COM/WScript
   */
  public async sendMessageViaVBScript(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // Create VBScript for automation
      const vbScript = `
        Set WshShell = CreateObject("WScript.Shell")
        
        ' Start Phone Link
        WshShell.Run "ms-phone:", 1, False
        WScript.Sleep 2000
        
        ' Activate window
        WshShell.AppActivate "Phone Link"
        WScript.Sleep 500
        
        ' New message shortcut
        WshShell.SendKeys "^n"
        WScript.Sleep 1000
        
        ' Type phone number
        WshShell.SendKeys "${phoneNumber}"
        WScript.Sleep 500
        
        ' Tab to message
        WshShell.SendKeys "{TAB}"
        WScript.Sleep 300
        
        ' Type message
        WshShell.SendKeys "${message.replace(/"/g, '""')}"
        WScript.Sleep 500
        
        ' Send
        WshShell.SendKeys "{ENTER}"
        WScript.Sleep 500
        
        ' Minimize
        WshShell.SendKeys "%{F9}"
        
        WScript.Echo "SUCCESS"
      `;
      
      return new Promise((resolve) => {
        exec(`echo '${vbScript}' | cscript //nologo`, (error, stdout, stderr) => {
          if (stdout.includes('SUCCESS')) {
            log.info('✅ Message sent via VBScript automation');
            resolve(true);
          } else {
            log.error('❌ VBScript automation failed:', error || stderr);
            resolve(false);
          }
        });
      });
      
    } catch (error) {
      log.error('❌ VBScript automation error:', error);
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
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
Add-Type -AssemblyName System.Threading

# Start Phone Link if not already running
Start-Process "ms-phone:" -WindowStyle Normal
Start-Sleep -Milliseconds 800

# Focus Phone Link window
$phoneLink = Get-Process | Where-Object {$_.ProcessName -like "*Phone*" -or $_.ProcessName -like "*YourPhone*"}
if ($phoneLink) {
  [System.Windows.Forms.SendKeys]::SendWait("%{TAB}")
  Start-Sleep -Milliseconds 200
}

# NEW MESSAGE - Ctrl+N
[System.Windows.Forms.SendKeys]::SendWait("^n")
Start-Sleep -Milliseconds 400

# TYPE PHONE NUMBER
[System.Windows.Forms.SendKeys]::SendWait("${phoneNumber}")
Start-Sleep -Milliseconds 200

# TAB TO MESSAGE FIELD
[System.Windows.Forms.SendKeys]::SendWait("{TAB}")
Start-Sleep -Milliseconds 150

# TYPE MESSAGE
[System.Windows.Forms.SendKeys]::SendWait("${message.replace(/"/g, '""')}")
Start-Sleep -Milliseconds 200

# SEND MESSAGE - ENTER KEY
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 300

# MINIMIZE PHONE LINK
[System.Windows.Forms.SendKeys]::SendWait("%{F9}")

Write-Output "SUCCESS"
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
        
        // Timeout after 6 seconds (much faster)
        setTimeout(() => {
          psProcess.kill();
          log.error('❌ Phone Link automation timed out (6 seconds)');
          resolve(false);
        }, 6000);
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
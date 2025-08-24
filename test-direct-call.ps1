Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Write-Host "🚀 Testing Phone Link call automation to 941-518-0701..." -ForegroundColor Green

# Start Phone Link if not already running
Start-Process "ms-phone:" -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Host "STEP 1: Phone Link launched, finding main window..." -ForegroundColor Yellow

try {
  # Find Phone Link process
  $phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
  
  if (-not $phoneProcess) {
    Write-Host "ERROR: Phone Link process not found" -ForegroundColor Red
    exit 1
  }
  
  # Get Phone Link window
  $mainWindowHandle = $phoneProcess.MainWindowHandle
  $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)
  
  if (-not $phoneLinkWindow) {
    Write-Host "ERROR: Could not access Phone Link window" -ForegroundColor Red
    exit 1
  }
  
  Write-Host "STEP 2: Navigating to Calls section..." -ForegroundColor Yellow
  
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
    Write-Host "Found Calls tab, clicking..." -ForegroundColor Green
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
    Write-Host "Calls tab not found, trying navigation shortcuts..." -ForegroundColor Yellow
    # Try keyboard navigation to calls
    [System.Windows.Forms.SendKeys]::SendWait("^2")  # Ctrl+2 might be calls
    Start-Sleep -Milliseconds 1000
  }
  
  Write-Host "STEP 3: Looking for dial pad or call interface..." -ForegroundColor Yellow
  
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
      Write-Host "Found dial interface: $($dialButton.Current.Name)" -ForegroundColor Green
      break 
    }
  }
  
  if ($dialButton) {
    Write-Host "STEP 4: Clicking dial interface..." -ForegroundColor Yellow
    $invokePattern = $dialButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
    Start-Sleep -Seconds 2
  } else {
    Write-Host "No dial interface found, trying direct number input..." -ForegroundColor Yellow
  }
  
  Write-Host "STEP 5: Looking for phone number input field..." -ForegroundColor Yellow
  
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
      Write-Host "Found number input field: $($numberInput.Current.AutomationId)" -ForegroundColor Green
      break 
    }
  }
  
  if ($numberInput) {
    Write-Host "STEP 6: Entering phone number 941-518-0701..." -ForegroundColor Yellow
    $numberInput.SetFocus()
    Start-Sleep -Milliseconds 500
    
    # Clear and type number
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("941-518-0701")
    Start-Sleep -Milliseconds 1000
  } else {
    Write-Host "No input field found, typing number directly..." -ForegroundColor Yellow
    [System.Windows.Forms.SendKeys]::SendWait("941-518-0701")
    Start-Sleep -Milliseconds 1000
  }
  
  Write-Host "STEP 7: Looking for call button..." -ForegroundColor Yellow
  
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
      Write-Host "Found call button: $($callButton.Current.Name)" -ForegroundColor Green
      break 
    }
  }
  
  if ($callButton) {
    Write-Host "STEP 8: Clicking call button to initiate call..." -ForegroundColor Yellow
    $invokePattern = $callButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
    Start-Sleep -Milliseconds 1000
    Write-Host "SUCCESS: Call button clicked for 941-518-0701" -ForegroundColor Green
  } else {
    Write-Host "Call button not found, trying Enter key..." -ForegroundColor Yellow
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
    Write-Host "SUCCESS: Call initiated with Enter key for 941-518-0701" -ForegroundColor Green
  }

} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  # Fallback method - try the simple approach
  Write-Host "FALLBACK: Trying simple keyboard navigation..." -ForegroundColor Yellow
  [System.Windows.Forms.SendKeys]::SendWait("^2")  # Navigate to calls
  Start-Sleep -Milliseconds 1000
  [System.Windows.Forms.SendKeys]::SendWait("941-518-0701")
  Start-Sleep -Milliseconds 1000
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Write-Host "FALLBACK_SUCCESS: Call attempted via keyboard navigation" -ForegroundColor Green
}

Write-Host "CALL_AUTOMATION_COMPLETE" -ForegroundColor Cyan
Write-Host "Check your iPhone and Phone Link to see if the call was initiated!" -ForegroundColor Cyan
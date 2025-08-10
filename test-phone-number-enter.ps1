# Test Phone Number + ENTER sequence
Write-Host "TESTING PHONE NUMBER + ENTER SEQUENCE..." -ForegroundColor Cyan

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$phoneNumber = "9415180701"

try {
    Write-Host "Step 1: Starting Phone Link..." -ForegroundColor Yellow
    Start-Process "ms-phone:" -WindowStyle Normal
    Start-Sleep -Milliseconds 1500
    
    # Find Phone Link process
    $phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
    
    if (-not $phoneProcess) {
        Write-Host "Phone Link process not found!" -ForegroundColor Red
        exit
    }
    
    $mainWindowHandle = $phoneProcess.MainWindowHandle
    $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)
    
    Write-Host "Step 2: Clicking New Message button..." -ForegroundColor Yellow
    
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
        Write-Host "Found New Message button, clicking..." -ForegroundColor Green
        $invokePattern = $newMessageButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $invokePattern.Invoke()
        Start-Sleep -Milliseconds 1000
        
        Write-Host "Step 3: Typing phone number: $phoneNumber" -ForegroundColor Yellow
        [System.Windows.Forms.SendKeys]::SendWait($phoneNumber)
        Start-Sleep -Milliseconds 500
        
        Write-Host "Step 4: Pressing ENTER to load contact..." -ForegroundColor Yellow
        Write-Host "PRESSING ENTER NOW!" -ForegroundColor Red
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        
        Write-Host "Step 5: Waiting for contact to load..." -ForegroundColor Yellow
        Start-Sleep -Milliseconds 2000
        
        Write-Host "Step 6: Checking if Send button is now enabled..." -ForegroundColor Yellow
        
        # Check Send button status
        $sendButtonCondition = [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
            "SendMessageButton"
        )
        
        $sendButton = $phoneLinkWindow.FindFirst(
            [System.Windows.Automation.TreeScope]::Descendants, 
            $sendButtonCondition
        )
        
        if ($sendButton) {
            Write-Host "SEND BUTTON FOUND!" -ForegroundColor Green
            Write-Host "Enabled: $($sendButton.Current.IsEnabled)" -ForegroundColor $(if ($sendButton.Current.IsEnabled) {'Green'} else {'Red'})
            
            if ($sendButton.Current.IsEnabled) {
                Write-Host "SUCCESS! Contact loaded and Send button is enabled!" -ForegroundColor Green
            } else {
                Write-Host "PROBLEM: Send button still disabled after ENTER" -ForegroundColor Red
            }
        } else {
            Write-Host "PROBLEM: Send button not found at all" -ForegroundColor Red
        }
        
    } else {
        Write-Host "New Message button not found!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TEST COMPLETE ===" -ForegroundColor Cyan
Write-Host "Did you see the ENTER keystroke happen in Phone Link?" -ForegroundColor Yellow
Write-Host "Was the contact loaded after ENTER?" -ForegroundColor Yellow
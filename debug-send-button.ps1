# Debug Send Button Status
Write-Host "DEBUGGING SEND BUTTON STATUS..." -ForegroundColor Cyan

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

try {
    $phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
    
    if (-not $phoneProcess) {
        Write-Host "Phone Link not running!" -ForegroundColor Red
        exit
    }
    
    $mainWindowHandle = $phoneProcess.MainWindowHandle
    $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)
    
    Write-Host "=== CURRENT SEND BUTTON STATUS ===" -ForegroundColor Yellow
    
    # Find Send button
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
        Write-Host "Name: '$($sendButton.Current.Name)'" -ForegroundColor White
        Write-Host "AutomationId: '$($sendButton.Current.AutomationId)'" -ForegroundColor White
        Write-Host "Enabled: $($sendButton.Current.IsEnabled)" -ForegroundColor $(if ($sendButton.Current.IsEnabled) {'Green'} else {'Red'})
        Write-Host "Visible: $(-not $sendButton.Current.IsOffscreen)" -ForegroundColor White
        Write-Host "BoundingRect: $($sendButton.Current.BoundingRectangle)" -ForegroundColor White
        
        # Check patterns supported
        $patterns = $sendButton.GetSupportedPatterns()
        Write-Host "Supported Patterns:" -ForegroundColor Cyan
        foreach ($pattern in $patterns) {
            Write-Host "  - $pattern" -ForegroundColor White
        }
        
        if (-not $sendButton.Current.IsEnabled) {
            Write-Host "SEND BUTTON IS DISABLED! Checking message input..." -ForegroundColor Red
            
            # Check message input
            $inputCondition = [System.Windows.Automation.PropertyCondition]::new(
                [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
                "InputTextBox"
            )
            
            $inputBox = $phoneLinkWindow.FindFirst(
                [System.Windows.Automation.TreeScope]::Descendants, 
                $inputCondition
            )
            
            if ($inputBox) {
                Write-Host "MESSAGE INPUT FOUND!" -ForegroundColor Green
                Write-Host "Current Text: '$($inputBox.GetCurrentPropertyValue([System.Windows.Automation.ValuePattern]::ValueProperty))'" -ForegroundColor Yellow
                Write-Host "Has Focus: $($inputBox.Current.HasKeyboardFocus)" -ForegroundColor White
            } else {
                Write-Host "MESSAGE INPUT NOT FOUND!" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "SEND BUTTON NOT FOUND!" -ForegroundColor Red
        
        # Look for ANY buttons with "send" in name
        Write-Host "Looking for any send-related buttons..." -ForegroundColor Yellow
        
        $allButtons = $phoneLinkWindow.FindAll(
            [System.Windows.Automation.TreeScope]::Descendants,
            [System.Windows.Automation.PropertyCondition]::new(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::Button
            )
        )
        
        foreach ($button in $allButtons) {
            if ($button.Current.Name -like "*send*" -or $button.Current.AutomationId -like "*send*") {
                Write-Host "Found button: Name='$($button.Current.Name)' AutomationId='$($button.Current.AutomationId)' Enabled=$($button.Current.IsEnabled)" -ForegroundColor Yellow
            }
        }
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== INSTRUCTIONS ===" -ForegroundColor Cyan
Write-Host "1. If Send button is DISABLED, type some text in the message box manually" -ForegroundColor White
Write-Host "2. Run this script again to see if it becomes enabled" -ForegroundColor White
Write-Host "3. This will help us understand the timing issue" -ForegroundColor White
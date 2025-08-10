# Check what's happening with our Send button automation
Write-Host "CHECKING PHONE LINK AUTOMATION STATUS..." -ForegroundColor Cyan

# Test the Send button click directly
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

try {
    # Find Phone Link process
    $phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
    
    if (-not $phoneProcess) {
        Write-Host "Phone Link process not found!" -ForegroundColor Red
        exit
    }
    
    Write-Host "Found Phone Link process: $($phoneProcess.Id)" -ForegroundColor Green
    
    # Get the main window
    $mainWindowHandle = $phoneProcess.MainWindowHandle
    
    if ($mainWindowHandle -eq [System.IntPtr]::Zero) {
        Write-Host "Phone Link window handle is zero - window might be minimized" -ForegroundColor Red
        exit
    }
    
    Write-Host "Got window handle: $mainWindowHandle" -ForegroundColor Green
    
    # Create automation element
    $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)
    
    if (-not $phoneLinkWindow) {
        Write-Host "Could not create automation element!" -ForegroundColor Red
        exit
    }
    
    Write-Host "Created automation element successfully" -ForegroundColor Green
    
    # Find the message input box
    $inputCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
        "InputTextBox"
    )
    
    $inputBox = $phoneLinkWindow.FindFirst(
        [System.Windows.Automation.TreeScope]::Descendants, 
        $inputCondition
    )
    
    if ($inputBox) {
        Write-Host "Found input text box!" -ForegroundColor Green
        Write-Host "  Current value: '$($inputBox.Current.Name)'" -ForegroundColor Yellow
    } else {
        Write-Host "Input text box not found!" -ForegroundColor Red
    }
    
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
        Write-Host "Found Send button!" -ForegroundColor Green
        Write-Host "  Name: '$($sendButton.Current.Name)'" -ForegroundColor Yellow
        Write-Host "  Enabled: $($sendButton.Current.IsEnabled)" -ForegroundColor Yellow
        Write-Host "  Visible: $(-not $sendButton.Current.IsOffscreen)" -ForegroundColor Yellow
        
        if (-not $sendButton.Current.IsEnabled) {
            Write-Host "ISSUE: Send button is DISABLED - needs text in message box!" -ForegroundColor Red
        }
        
        # Check if button supports Invoke pattern
        $invokePattern = $null
        try {
            $invokePattern = $sendButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            if ($invokePattern) {
                Write-Host "Send button supports Invoke pattern - can be clicked!" -ForegroundColor Green
            }
        } catch {
            Write-Host "Send button does NOT support Invoke pattern!" -ForegroundColor Red
        }
    } else {
        Write-Host "Send button not found!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.Exception.StackTrace -ForegroundColor Gray
}
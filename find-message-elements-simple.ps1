# Simple approach - manually click a conversation first, then scan for elements
Write-Host "FINDING MESSAGE ELEMENTS - SIMPLE APPROACH" -ForegroundColor Cyan
Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host "1. MANUALLY click on a conversation in Phone Link (any conversation)" -ForegroundColor White
Write-Host "2. Make sure you can see the message input box at the bottom" -ForegroundColor White
Write-Host "3. Press ANY KEY here to continue scanning..." -ForegroundColor White
Write-Host ""

$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "Scanning Phone Link for message elements..." -ForegroundColor Green

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

try {
    # Find Phone Link process
    $phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
    
    if (-not $phoneProcess) {
        Write-Host "Phone Link not running!" -ForegroundColor Red
        exit
    }
    
    $mainWindowHandle = $phoneProcess.MainWindowHandle
    $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)
    
    Write-Host "Scanning for ALL text input fields..." -ForegroundColor Yellow
    
    # Find ALL edit controls
    $editControls = $phoneLinkWindow.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Edit
        )
    )
    
    Write-Host "Found $($editControls.Count) text input fields:" -ForegroundColor Cyan
    
    for ($i = 0; $i -lt $editControls.Count; $i++) {
        $edit = $editControls[$i]
        
        Write-Host ""
        Write-Host "=== TEXT INPUT $($i + 1) ===" -ForegroundColor Green
        Write-Host "Name: '$($edit.Current.Name)'" -ForegroundColor White
        Write-Host "AutomationId: '$($edit.Current.AutomationId)'" -ForegroundColor White
        Write-Host "ClassName: '$($edit.Current.ClassName)'" -ForegroundColor White
        Write-Host "Enabled: $($edit.Current.IsEnabled)" -ForegroundColor White
        
        # Check if this looks like message input
        $isMessageInput = ($edit.Current.Name -like "*message*") -or 
                         ($edit.Current.Name -like "*send*") -or
                         ($edit.Current.Name -like "*text*") -or
                         ($edit.Current.AutomationId -like "*message*") -or
                         ($edit.Current.AutomationId -like "*input*") -or
                         ($edit.Current.AutomationId -like "*text*")
        
        if ($isMessageInput) {
            Write-Host ">>> THIS IS LIKELY THE MESSAGE INPUT BOX! <<<" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "Scanning for ALL buttons..." -ForegroundColor Yellow
    
    # Find ALL buttons
    $buttons = $phoneLinkWindow.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Button
        )
    )
    
    Write-Host "Found $($buttons.Count) buttons total. Looking for Send-related buttons:" -ForegroundColor Cyan
    
    $sendButtons = @()
    
    for ($i = 0; $i -lt $buttons.Count; $i++) {
        $button = $buttons[$i]
        
        # Look for send-related buttons
        $isSendButton = ($button.Current.Name -like "*send*") -or 
                       ($button.Current.AutomationId -like "*send*") -or
                       ($button.Current.Name -eq "Send") -or
                       ($button.Current.AutomationId -eq "Send")
        
        if ($isSendButton) {
            $sendButtons += $button
            
            Write-Host ""
            Write-Host "=== SEND BUTTON FOUND! ===" -ForegroundColor Red
            Write-Host "Name: '$($button.Current.Name)'" -ForegroundColor Red
            Write-Host "AutomationId: '$($button.Current.AutomationId)'" -ForegroundColor Red
            Write-Host "ClassName: '$($button.Current.ClassName)'" -ForegroundColor Red
            Write-Host "Enabled: $($button.Current.IsEnabled)" -ForegroundColor Red
            Write-Host "Visible: $(-not $button.Current.IsOffscreen)" -ForegroundColor Red
        }
    }
    
    if ($sendButtons.Count -eq 0) {
        Write-Host ""
        Write-Host "No obvious Send buttons found. Showing ALL buttons with names:" -ForegroundColor Yellow
        
        for ($i = 0; $i -lt $buttons.Count; $i++) {
            $button = $buttons[$i]
            if ($button.Current.Name -ne "" -or $button.Current.AutomationId -ne "") {
                Write-Host "Button: Name='$($button.Current.Name)' AutomationId='$($button.Current.AutomationId)'" -ForegroundColor White
            }
        }
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== INSTRUCTIONS FOR NEXT STEP ===" -ForegroundColor Cyan
Write-Host "Copy the AutomationId and Name of:" -ForegroundColor Yellow
Write-Host "1. The MESSAGE INPUT BOX (text field)" -ForegroundColor White
Write-Host "2. The SEND BUTTON" -ForegroundColor White
Write-Host "We'll use these to fix our automation code!" -ForegroundColor Yellow
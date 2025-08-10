# Test clicking on a conversation and finding message elements
Write-Host "TESTING CONVERSATION CLICK AND MESSAGE ELEMENTS..." -ForegroundColor Cyan

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
    
    Write-Host "Found Phone Link window" -ForegroundColor Green
    
    # 1. First make sure we're on the Messages tab
    Write-Host "Step 1: Clicking Messages tab..." -ForegroundColor Yellow
    
    $messagesTabCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 
        "ChatNodeAutomationId"
    )
    
    $messagesTab = $phoneLinkWindow.FindFirst(
        [System.Windows.Automation.TreeScope]::Descendants, 
        $messagesTabCondition
    )
    
    if ($messagesTab) {
        Write-Host "Found Messages tab, clicking..." -ForegroundColor Green
        $invokePattern = $messagesTab.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $invokePattern.Invoke()
        Start-Sleep -Milliseconds 1000
    } else {
        Write-Host "Messages tab not found!" -ForegroundColor Red
    }
    
    # 2. Find and click the first conversation
    Write-Host "Step 2: Finding first conversation..." -ForegroundColor Yellow
    
    $conversationList = $phoneLinkWindow.FindFirst(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
            "CVSListView"
        )
    )
    
    if ($conversationList) {
        Write-Host "Found conversation list" -ForegroundColor Green
        
        # Find first conversation item
        $firstConversation = $conversationList.FindFirst(
            [System.Windows.Automation.TreeScope]::Children,
            [System.Windows.Automation.PropertyCondition]::new(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::ListItem
            )
        )
        
        if ($firstConversation) {
            Write-Host "Found first conversation: $($firstConversation.Current.Name)" -ForegroundColor Green
            Write-Host "Clicking conversation..." -ForegroundColor Yellow
            
            $invokePattern = $firstConversation.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            $invokePattern.Invoke()
            Start-Sleep -Milliseconds 2000
        } else {
            Write-Host "No conversations found!" -ForegroundColor Red
        }
    } else {
        Write-Host "Conversation list not found!" -ForegroundColor Red
    }
    
    # 3. Now look for message input and send button
    Write-Host "Step 3: Looking for message input and send button..." -ForegroundColor Yellow
    
    # Search for all edit controls (text input boxes)
    $editControls = $phoneLinkWindow.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Edit
        )
    )
    
    Write-Host "Found $($editControls.Count) edit controls:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $editControls.Count; $i++) {
        $edit = $editControls[$i]
        Write-Host "  Edit $i:" -ForegroundColor White
        Write-Host "    Name: '$($edit.Current.Name)'" -ForegroundColor White
        Write-Host "    AutomationId: '$($edit.Current.AutomationId)'" -ForegroundColor White
        Write-Host "    ClassName: '$($edit.Current.ClassName)'" -ForegroundColor White
        
        if ($edit.Current.Name -like "*message*" -or $edit.Current.AutomationId -like "*message*" -or $edit.Current.AutomationId -like "*input*") {
            Write-Host "    >>> THIS LOOKS LIKE THE MESSAGE INPUT! <<<" -ForegroundColor Red
        }
    }
    
    # Search for all buttons
    $buttons = $phoneLinkWindow.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Button
        )
    )
    
    Write-Host ""
    Write-Host "Found $($buttons.Count) buttons, looking for Send button:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $buttons.Count; $i++) {
        $button = $buttons[$i]
        
        if ($button.Current.Name -like "*send*" -or $button.Current.AutomationId -like "*send*") {
            Write-Host "  >>> FOUND SEND BUTTON! <<<" -ForegroundColor Red
            Write-Host "    Name: '$($button.Current.Name)'" -ForegroundColor Red
            Write-Host "    AutomationId: '$($button.Current.AutomationId)'" -ForegroundColor Red
            Write-Host "    ClassName: '$($button.Current.ClassName)'" -ForegroundColor Red
            Write-Host "    Enabled: $($button.Current.IsEnabled)" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.Exception.StackTrace -ForegroundColor Gray
}

Write-Host ""
Write-Host "Test complete! Look for MESSAGE INPUT and SEND BUTTON above." -ForegroundColor Yellow
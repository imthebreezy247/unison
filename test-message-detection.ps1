# Test Phone Link Message Detection
Write-Host "Testing Phone Link message detection..." -ForegroundColor Cyan

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# Find Phone Link process
$phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue

if ($phoneProcess) {
    Write-Host "Phone Link process found: $($phoneProcess.Id)" -ForegroundColor Green
    
    # Get main window
    $mainWindowHandle = $phoneProcess.MainWindowHandle
    if ($mainWindowHandle -ne [System.IntPtr]::Zero) {
        $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)
        
        if ($phoneLinkWindow) {
            Write-Host "Accessing Phone Link window..." -ForegroundColor Green
            
            # Look for message elements
            Write-Host "Searching for message elements..." -ForegroundColor Yellow
            
            # Find all text elements that might contain messages
            $textCondition = [System.Windows.Automation.PropertyCondition]::new(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty, 
                [System.Windows.Automation.ControlType]::Text
            )
            $textElements = $phoneLinkWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $textCondition)
            
            Write-Host "Found $($textElements.Count) text elements" -ForegroundColor Cyan
            
            foreach ($element in $textElements) {
                $text = $element.Current.Name
                if ($text -and $text.Length -gt 5 -and $text -notlike "*Phone Link*" -and $text -notlike "*Microsoft*") {
                    Write-Host "Text: $text" -ForegroundColor White
                }
            }
            
            # Also check for list items (conversations)
            $listCondition = [System.Windows.Automation.PropertyCondition]::new(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty, 
                [System.Windows.Automation.ControlType]::ListItem
            )
            $listItems = $phoneLinkWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $listCondition)
            
            Write-Host "Found $($listItems.Count) list items (conversations)" -ForegroundColor Cyan
            
            foreach ($item in $listItems | Select-Object -First 10) {
                $itemText = $item.Current.Name
                if ($itemText -and $itemText.Length -gt 0) {
                    Write-Host "Conversation: $itemText" -ForegroundColor Magenta
                }
            }
        }
    }
} else {
    Write-Host "Phone Link process not found" -ForegroundColor Red
}

Write-Host "Detection test complete!" -ForegroundColor Green
# Phone Link UI Element Inspector
Write-Host "FINDING PHONE LINK SEND BUTTON..." -ForegroundColor Cyan

# Load UI Automation assemblies
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

try {
    # Find Phone Link process
    $phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
    
    if (-not $phoneProcess) {
        Write-Host "Phone Link process not found. Please open Phone Link first." -ForegroundColor Red
        exit
    }
    
    Write-Host "Found Phone Link process: $($phoneProcess.Id)" -ForegroundColor Green
    
    # Get the main window
    $mainWindowHandle = $phoneProcess.MainWindowHandle
    if ($mainWindowHandle -eq [System.IntPtr]::Zero) {
        Write-Host "Phone Link window not found or minimized." -ForegroundColor Red
        exit
    }
    
    # Create automation element from window handle
    $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)
    
    if (-not $phoneLinkWindow) {
        Write-Host "Could not create automation element from Phone Link window." -ForegroundColor Red
        exit
    }
    
    Write-Host "Got Phone Link automation element" -ForegroundColor Green
    Write-Host "Window name: $($phoneLinkWindow.Current.Name)" -ForegroundColor Yellow
    
    # Function to recursively find all elements
    function Find-AllElements {
        param($element, $depth = 0)
        
        $indent = "  " * $depth
        
        try {
            $name = $element.Current.Name
            $className = $element.Current.ClassName
            $controlType = $element.Current.ControlType.LocalizedControlType
            $automationId = $element.Current.AutomationId
            
            # Look for potential send buttons
            $isSendButton = ($name -like "*Send*") -or 
                           ($name -like "*send*") -or
                           ($automationId -like "*send*") -or
                           ($automationId -like "*Send*") -or
                           ($className -like "*Button*" -and $name -eq "Send") -or
                           ($controlType -eq "button" -and $name -match "Send|send")
            
            if ($isSendButton -or $name -ne "" -or $automationId -ne "") {
                $color = if ($isSendButton) { "Red" } else { "White" }
                Write-Host "$indent FOUND: $controlType" -ForegroundColor $color
                Write-Host "$indent   Name: '$name'" -ForegroundColor $color
                Write-Host "$indent   AutomationId: '$automationId'" -ForegroundColor $color
                Write-Host "$indent   ClassName: '$className'" -ForegroundColor $color
                
                if ($isSendButton) {
                    Write-Host "$indent   POTENTIAL SEND BUTTON!" -ForegroundColor Red
                    
                    # Try to get more details about this button
                    try {
                        $boundingRect = $element.Current.BoundingRectangle
                        Write-Host "$indent   Position: $($boundingRect.X), $($boundingRect.Y)" -ForegroundColor Red
                        Write-Host "$indent   Size: $($boundingRect.Width) x $($boundingRect.Height)" -ForegroundColor Red
                        
                        # Check if it's enabled and visible
                        Write-Host "$indent   Enabled: $($element.Current.IsEnabled)" -ForegroundColor Red
                        Write-Host "$indent   Visible: $(-not $element.Current.IsOffscreen)" -ForegroundColor Red
                        
                    } catch {
                        Write-Host "$indent   Could not get button details" -ForegroundColor Yellow
                    }
                }
                Write-Host ""
            }
            
            # Get child elements
            if ($depth -lt 5) {  # Limit depth to avoid infinite recursion
                $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
                
                foreach ($child in $children) {
                    Find-AllElements $child ($depth + 1)
                }
            }
            
        } catch {
            # Ignore errors for individual elements
        }
    }
    
    Write-Host "Scanning Phone Link UI for Send buttons and other elements..." -ForegroundColor Cyan
    Write-Host "This might take a moment..." -ForegroundColor Yellow
    Write-Host ""
    
    # Start the recursive search
    Find-AllElements $phoneLinkWindow
    
    Write-Host ""
    Write-Host "UI scan complete!" -ForegroundColor Green
    Write-Host "Look for elements marked with POTENTIAL SEND BUTTON!" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error during UI inspection: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Instructions:" -ForegroundColor Cyan
Write-Host "1. Look for any SEND BUTTON elements above" -ForegroundColor White
Write-Host "2. Note the AutomationId and Name of send buttons" -ForegroundColor White
Write-Host "3. We will use this info to click the actual send button" -ForegroundColor White
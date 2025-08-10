# Scan Phone Link's ACTUAL UI structure
Write-Host "SCANNING PHONE LINK UI STRUCTURE..." -ForegroundColor Cyan

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# Find Phone Link process
$phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue

if (-not $phoneProcess) {
    Write-Host "Phone Link not running!" -ForegroundColor Red
    exit
}

$mainWindowHandle = $phoneProcess.MainWindowHandle
$phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)

Write-Host "Scanning ALL UI elements in Phone Link..." -ForegroundColor Yellow
Write-Host "Looking for text boxes, buttons, and input fields..." -ForegroundColor Yellow
Write-Host ""

# Function to find ALL elements
function Scan-Elements {
    param($element, $depth = 0)
    
    if ($depth -gt 8) { return }  # Limit depth
    
    $indent = "  " * $depth
    
    try {
        $name = $element.Current.Name
        $className = $element.Current.ClassName  
        $controlType = $element.Current.ControlType.LocalizedControlType
        $automationId = $element.Current.AutomationId
        
        # Look for ANY input fields, buttons, or text areas
        $isInteresting = ($controlType -eq "edit") -or 
                        ($controlType -eq "button") -or 
                        ($controlType -eq "text") -or
                        ($name -like "*message*") -or
                        ($name -like "*send*") -or
                        ($name -like "*text*") -or
                        ($name -like "*input*") -or
                        ($automationId -like "*text*") -or
                        ($automationId -like "*input*") -or
                        ($automationId -like "*message*") -or
                        ($automationId -like "*send*") -or
                        ($automationId -like "*button*")
        
        if ($isInteresting -or $name -ne "" -or $automationId -ne "") {
            $color = if ($isInteresting) { "Green" } else { "White" }
            
            Write-Host "$indent [$controlType]" -ForegroundColor $color
            if ($name -ne "") { Write-Host "$indent   Name: '$name'" -ForegroundColor $color }
            if ($automationId -ne "") { Write-Host "$indent   AutomationId: '$automationId'" -ForegroundColor $color }
            if ($className -ne "") { Write-Host "$indent   ClassName: '$className'" -ForegroundColor $color }
            
            # Special highlighting for potential message elements
            if ($controlType -eq "edit" -or $name -like "*message*" -or $name -like "*send*") {
                Write-Host "$indent   >>> POTENTIAL MESSAGE ELEMENT! <<<" -ForegroundColor Red
            }
            
            Write-Host ""
        }
        
        # Recurse through children
        $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($child in $children) {
            Scan-Elements $child ($depth + 1)
        }
        
    } catch {
        # Ignore individual element errors
    }
}

# Start scanning
Scan-Elements $phoneLinkWindow

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Look for elements marked with >>> POTENTIAL MESSAGE ELEMENT! <<<" -ForegroundColor Yellow
Write-Host "These are the AutomationIds and Names we need to use in our code." -ForegroundColor Yellow
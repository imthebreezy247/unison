# Explore Phone Link UI Elements
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Start-Process "ms-phone:" -WindowStyle Normal
Start-Sleep -Seconds 2

$phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
if ($phoneProcess) {
    $mainWindowHandle = $phoneProcess.MainWindowHandle
    $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($mainWindowHandle)
    
    Write-Host "EXPLORING PHONE LINK UI:" -ForegroundColor Cyan
    
    # Get ALL clickable elements
    $condition = [System.Windows.Automation.Condition]::TrueCondition
    $elements = $phoneLinkWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    
    Write-Host "Total elements found: $($elements.Count)" -ForegroundColor Yellow
    
    # Filter for interesting elements
    foreach ($element in $elements) {
        $name = $element.Current.Name
        $type = $element.Current.ControlType.ProgrammaticName
        $automationId = $element.Current.AutomationId
        
        # Look for call-related elements
        if ($name -like "*call*" -or $name -like "*dial*" -or $name -like "*phone*" -or 
            $automationId -like "*call*" -or $automationId -like "*dial*" -or
            $type -eq "ControlType.Button" -or $type -eq "ControlType.Edit") {
            
            Write-Host "Element: $name" -ForegroundColor Green
            Write-Host "  Type: $type" -ForegroundColor White
            Write-Host "  ID: $automationId" -ForegroundColor Cyan
        }
    }
}
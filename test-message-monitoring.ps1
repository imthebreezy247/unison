# Test the new message monitoring system
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Write-Host "Testing new message monitoring system..." -ForegroundColor Cyan

try {
  $phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
  
  if ($phoneProcess -and $phoneProcess.MainWindowHandle -ne [System.IntPtr]::Zero) {
    $phoneLinkWindow = [System.Windows.Automation.AutomationElement]::FromHandle($phoneProcess.MainWindowHandle)
    
    if ($phoneLinkWindow) {
      Write-Host "Found Phone Link window" -ForegroundColor Green
      
      # Look for unread message indicators or new conversation items
      $listCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty, 
        [System.Windows.Automation.ControlType]::ListItem
      )
      $listItems = $phoneLinkWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $listCondition)
      
      Write-Host "Found $($listItems.Count) conversation items" -ForegroundColor Yellow
      
      foreach ($item in $listItems | Select-Object -First 10) {
        $itemText = $item.Current.Name
        if ($itemText -and $itemText.Contains("Conversation with")) {
          Write-Host "`nConversation: $itemText" -ForegroundColor White
          
          if ($itemText.Contains("Unread messages")) {
            Write-Host "  -> HAS UNREAD MESSAGES!" -ForegroundColor Red
            
            # Parse conversation info
            if ($itemText -match "Conversation with (.+?)\..*Message preview\. (.+?)\s*$") {
              $contact = $matches[1].Trim()
              $messagePreview = $matches[2].Trim()
              
              Write-Host "  -> Contact: $contact" -ForegroundColor Cyan
              Write-Host "  -> Message: $messagePreview" -ForegroundColor Yellow
              
              # Only report if message preview is substantial
              if ($messagePreview.Length -gt 5 -and -not $messagePreview.Contains("Attachment:")) {
                Write-Host "  -> WOULD TRIGGER: NEW_MESSAGE|$contact|$messagePreview|$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')" -ForegroundColor Green
              }
            }
          }
        }
      }
    }
  } else {
    Write-Host "Phone Link not found or no main window" -ForegroundColor Red
  }
} catch {
  Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nMonitoring test complete!" -ForegroundColor Cyan
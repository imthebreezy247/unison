import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class PhoneLinkAccessibility extends EventEmitter {
  private accessibilityMonitor: any = null;
  private isMonitoring = false;

  constructor() {
    super();
  }

  /**
   * Use Windows UI Automation to reliably interact with Phone Link
   */
  public async sendMessageViaAccessibility(phoneNumber: string, message: string): Promise<boolean> {
    console.log(`📱 Sending message via Accessibility API to ${phoneNumber}`);

    // PowerShell script using UI Automation instead of SendKeys
    const script = `
Add-Type @"
using System;
using System.Windows.Automation;
using System.Threading;
using System.Diagnostics;
using System.Linq;

public class PhoneLinkAutomation
{
    public static bool SendMessage(string phoneNumber, string message)
    {
        try {
            // Find Phone Link window
            var phoneLinkProcess = Process.GetProcessesByName("PhoneExperienceHost").FirstOrDefault();
            if (phoneLinkProcess == null) {
                Console.WriteLine("Phone Link not running");
                return false;
            }

            // Get Phone Link window
            var phoneLinkWindow = AutomationElement.FromHandle(phoneLinkProcess.MainWindowHandle);
            if (phoneLinkWindow == null) {
                Console.WriteLine("Could not find Phone Link window");
                return false;
            }

            // Bring window to foreground
            var windowPattern = phoneLinkWindow.GetCurrentPattern(WindowPattern.Pattern) as WindowPattern;
            windowPattern?.SetWindowVisualState(WindowVisualState.Normal);
            
            Thread.Sleep(500);

            // Find Messages button and click it
            var messagesButton = phoneLinkWindow.FindFirst(TreeScope.Descendants, 
                new PropertyCondition(AutomationElement.NameProperty, "Messages"));
            if (messagesButton != null) {
                var invokePattern = messagesButton.GetCurrentPattern(InvokePattern.Pattern) as InvokePattern;
                invokePattern?.Invoke();
                Thread.Sleep(1000);
            }

            // Find New Message button
            var newMessageButton = phoneLinkWindow.FindFirst(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.NameProperty, "New message"));
            if (newMessageButton == null) {
                // Try alternative names
                newMessageButton = phoneLinkWindow.FindFirst(TreeScope.Descendants,
                    new PropertyCondition(AutomationElement.NameProperty, "Compose"));
            }
            
            if (newMessageButton != null) {
                var invokePattern = newMessageButton.GetCurrentPattern(InvokePattern.Pattern) as InvokePattern;
                invokePattern?.Invoke();
                Thread.Sleep(1000);
            }

            // Find phone number input field
            var phoneInput = phoneLinkWindow.FindFirst(TreeScope.Descendants,
                new AndCondition(
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit),
                    new PropertyCondition(AutomationElement.NameProperty, "To")
                ));
            
            if (phoneInput == null) {
                phoneInput = phoneLinkWindow.FindFirst(TreeScope.Descendants,
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
            }

            if (phoneInput != null) {
                phoneInput.SetFocus();
                var valuePattern = phoneInput.GetCurrentPattern(ValuePattern.Pattern) as ValuePattern;
                valuePattern?.SetValue(phoneNumber);
                Thread.Sleep(500);
            }

            // Tab to message field
            System.Windows.Forms.SendKeys.SendWait("{TAB}");
            Thread.Sleep(500);

            // Find message input field
            var messageInput = phoneLinkWindow.FindFirst(TreeScope.Descendants,
                new AndCondition(
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit),
                    new PropertyCondition(AutomationElement.NameProperty, "Type a message")
                ));

            if (messageInput != null) {
                messageInput.SetFocus();
                var valuePattern = messageInput.GetCurrentPattern(ValuePattern.Pattern) as ValuePattern;
                valuePattern?.SetValue(message);
                Thread.Sleep(500);
            } else {
                // If we can't find it, just type the message
                System.Windows.Forms.SendKeys.SendWait(message);
                Thread.Sleep(500);
            }

            // Find and click Send button
            var sendButton = phoneLinkWindow.FindFirst(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.NameProperty, "Send"));
            
            if (sendButton != null) {
                var invokePattern = sendButton.GetCurrentPattern(InvokePattern.Pattern) as InvokePattern;
                invokePattern?.Invoke();
                Console.WriteLine("Message sent successfully via Send button");
                return true;
            } else {
                // If no Send button, try Enter key
                System.Windows.Forms.SendKeys.SendWait("{ENTER}");
                Console.WriteLine("Message sent via Enter key");
                return true;
            }
        }
        catch (Exception ex) {
            Console.WriteLine($"Error: {ex.Message}");
            return false;
        }
    }
}
"@ -ReferencedAssemblies System.Windows.Forms, UIAutomationClient, UIAutomationTypes

# Execute the automation
[PhoneLinkAutomation]::SendMessage("${phoneNumber}", "${message}")
`;

    return new Promise((resolve) => {
      exec(`powershell.exe -ExecutionPolicy Bypass -Command "${script}"`, 
        { maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            console.error('❌ Accessibility automation error:', error);
            console.error('Stderr:', stderr);
            resolve(false);
          } else {
            console.log('✅ Accessibility automation output:', stdout);
            resolve(stdout.includes('successfully') || stdout.includes('True'));
          }
        }
      );
    });
  }

  /**
   * Monitor Phone Link UI for incoming messages using Accessibility API
   */
  public startAccessibilityMonitoring(): void {
    if (this.isMonitoring) return;
    
    console.log('👁️ Starting Phone Link accessibility monitoring...');
    this.isMonitoring = true;

    const monitorScript = `
Add-Type @"
using System;
using System.Windows.Automation;
using System.Threading;
using System.Linq;

public class PhoneLinkMonitor
{
    public static void Monitor()
    {
        try {
            var phoneLinkProcess = System.Diagnostics.Process.GetProcessesByName("PhoneExperienceHost").FirstOrDefault();
            if (phoneLinkProcess == null) {
                Console.WriteLine("ERROR: Phone Link not running");
                return;
            }

            var phoneLinkWindow = AutomationElement.FromHandle(phoneLinkProcess.MainWindowHandle);
            
            // Set up event handler for structure changes
            Automation.AddStructureChangedEventHandler(
                phoneLinkWindow,
                TreeScope.Descendants,
                (sender, e) => {
                    try {
                        var element = sender as AutomationElement;
                        if (element != null) {
                            var name = element.Current.Name;
                            var className = element.Current.ClassName;
                            
                            // Look for message-related changes
                            if (!string.IsNullOrEmpty(name) && 
                                (name.Contains("message") || name.Contains("Message") || 
                                 className.Contains("Message") || className.Contains("Chat"))) {
                                Console.WriteLine($"CHANGE: {name} | {className}");
                            }
                        }
                    } catch { }
                });

            Console.WriteLine("MONITORING: Started");
            
            // Keep monitoring
            while (true) {
                Thread.Sleep(1000);
                
                // Periodically check for new messages in the UI
                try {
                    var messageList = phoneLinkWindow.FindFirst(TreeScope.Descendants,
                        new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.List));
                    
                    if (messageList != null) {
                        var messages = messageList.FindAll(TreeScope.Children, Condition.TrueCondition);
                        Console.WriteLine($"MESSAGE_COUNT: {messages.Count}");
                    }
                } catch { }
            }
        }
        catch (Exception ex) {
            Console.WriteLine($"ERROR: {ex.Message}");
        }
    }
}
"@ -ReferencedAssemblies UIAutomationClient, UIAutomationTypes

[PhoneLinkMonitor]::Monitor()
`;

    // Run monitoring in background
    this.accessibilityMonitor = spawn('powershell.exe', 
      ['-ExecutionPolicy', 'Bypass', '-Command', monitorScript],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    this.accessibilityMonitor.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      console.log('📊 Accessibility monitor:', output);
      
      if (output.includes('CHANGE:')) {
        this.emit('ui-change', output);
      } else if (output.includes('MESSAGE_COUNT:')) {
        this.emit('message-count', output);
      }
    });

    this.accessibilityMonitor.stderr.on('data', (data: Buffer) => {
      console.error('❌ Monitor error:', data.toString());
    });
  }

  public stopAccessibilityMonitoring(): void {
    if (this.accessibilityMonitor) {
      this.accessibilityMonitor.kill();
      this.accessibilityMonitor = null;
      this.isMonitoring = false;
      console.log('🛑 Stopped accessibility monitoring');
    }
  }
}
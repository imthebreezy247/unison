// Quick test script for Phone Link call automation
const { WindowsUIAutomation } = require('./build/main/services/WindowsUIAutomation.js');

async function testCall() {
  console.log('🚀 Testing Phone Link call automation to 941-518-0701...');
  
  const automation = new WindowsUIAutomation();
  
  try {
    const success = await automation.makeCallThroughPhoneLink('941-518-0701');
    
    if (success) {
      console.log('✅ SUCCESS: Call automation completed successfully!');
      console.log('📞 Phone Link should now be calling 941-518-0701');
    } else {
      console.log('❌ FAILED: Call automation did not succeed');
      console.log('📋 Check the logs for more details');
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
}

testCall();
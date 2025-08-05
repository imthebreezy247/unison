const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🔍 INSPECTING PHONE LINK DATABASES...\n');

// Phone Link database paths we found
const dbPaths = [
  'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\LocalCache\\Indexed\\aefc6972-fad7-42d8-85d9-0b1a1ba9d5b4\\System\\Database\\contacts.db',
  'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\LocalCache\\Indexed\\aefc6972-fad7-42d8-85d9-0b1a1ba9d5b4\\System\\Database\\calling.db',
  'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\LocalCache\\Indexed\\aefc6972-fad7-42d8-85d9-0b1a1ba9d5b4\\System\\Database\\phoneapps.db',
  'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\LocalCache\\Indexed\\aefc6972-fad7-42d8-85d9-0b1a1ba9d5b4\\System\\Database\\settings.db'
];

// Look for messages database in all device directories
const indexedPath = 'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\LocalCache\\Indexed';
if (fs.existsSync(indexedPath)) {
  const deviceDirs = fs.readdirSync(indexedPath);
  deviceDirs.forEach(deviceDir => {
    const dbDir = path.join(indexedPath, deviceDir, 'System', 'Database');
    if (fs.existsSync(dbDir)) {
      const files = fs.readdirSync(dbDir);
      files.forEach(file => {
        if (file.endsWith('.db') || file.endsWith('.sqlite')) {
          const fullPath = path.join(dbDir, file);
          if (!dbPaths.some(p => p.includes(file))) {
            dbPaths.push(fullPath);
            console.log(`📱 Found additional database: ${file}`);
          }
        }
      });
    }
  });
}

console.log(`\n📊 Inspecting ${dbPaths.length} databases...\n`);

let messagesFound = false;

dbPaths.forEach((dbPath, index) => {
  if (!fs.existsSync(dbPath)) {
    return;
  }

  try {
    console.log(`\n════════════════════════════════════════════════════`);
    console.log(`📂 DATABASE: ${path.basename(dbPath)}`);
    console.log(`   Device ID: ${dbPath.split('\\\\')[9]}`);
    
    const db = new Database(dbPath, { readonly: true });
    
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`   📋 Tables: ${tables.map(t => t.name).join(', ')}`);

    // Check each table
    tables.forEach(table => {
      try {
        const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
        const colNames = columns.map(c => c.name);
        
        // Look for message-related tables
        const isMessageTable = table.name.toLowerCase().includes('message') || 
                             table.name.toLowerCase().includes('sms') || 
                             table.name.toLowerCase().includes('chat') ||
                             table.name.toLowerCase().includes('conversation') ||
                             colNames.some(col => 
                               col.toLowerCase().includes('message') || 
                               col.toLowerCase().includes('text') || 
                               col.toLowerCase().includes('content') ||
                               col.toLowerCase().includes('body')
                             );
        
        if (isMessageTable) {
          messagesFound = true;
          console.log(`\n   🎯 FOUND MESSAGE TABLE: ${table.name}`);
          console.log(`      Columns: ${colNames.join(', ')}`);
          
          // Get row count
          const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
          console.log(`      Row count: ${count.count}`);
          
          // Get sample data
          const rows = db.prepare(`SELECT * FROM ${table.name} LIMIT 3`).all();
          if (rows.length > 0) {
            console.log(`      Sample data:`);
            rows.forEach((row, i) => {
              console.log(`        Row ${i + 1}: ${JSON.stringify(row).substring(0, 300)}...`);
            });
          }
        }
      } catch (e) {
        // Ignore errors for individual tables
      }
    });
    
    db.close();
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
});

if (!messagesFound) {
  console.log('\n\n⚠️  NO MESSAGE TABLES FOUND IN STANDARD DATABASES!');
  console.log('🔍 Searching for additional message storage locations...\n');
  
  // Search for other potential message storage
  const searchDirs = [
    'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\LocalCache',
    'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\LocalState',
    'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\AC\\INetCache',
    'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\TempState'
  ];
  
  searchDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`   Checking: ${dir}`);
      try {
        const walk = (currentDir, depth = 0) => {
          if (depth > 3) return; // Limit depth
          const items = fs.readdirSync(currentDir);
          items.forEach(item => {
            const fullPath = path.join(currentDir, item);
            try {
              if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath, depth + 1);
              } else if (item.toLowerCase().includes('message') || 
                       item.toLowerCase().includes('sms') || 
                       item.toLowerCase().includes('chat') ||
                       item.toLowerCase().includes('conversation') ||
                       item.toLowerCase().includes('notification')) {
                console.log(`      📄 Found: ${fullPath}`);
              }
            } catch (e) {
              // Ignore permission errors
            }
          });
        };
        walk(dir);
      } catch (e) {
        // Ignore errors
      }
    }
  });
}

console.log('\n\n✅ Inspection complete!');
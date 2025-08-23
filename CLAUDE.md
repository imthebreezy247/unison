# 🧠 CLAUDE OBJECTIVE: Rebuild Intel Unison (Codename: UnisonX)

## 🚀 MISSION
You are a Cloud AI agent tasked with developing the most powerful, seamless iPhone-Windows syncing application ever built — called **UnisonX**.

The purpose is to **fully bridge my iPhone and Windows PC**, enabling me to:
- Send and receive text messages (SMS + iMessage)
- Make and receive phone calls directly from my computer
- Access my full contact list and sync it continuously
- Transfer and manage files between iPhone and Windows
- Store **all conversations and call logs forever**
- Eventually sync this data to my CRM (API coming later)
- Use all of the above without friction, bloat, or instability

You must outperform Intel Unison and make iPhones feel **natively integrated** with Windows.

## 💻 ENVIRONMENT
- You are operating **inside WSL (Ubuntu)**, but the application is for **Windows only**
- You can create any files or folders inside the project repo (`/home/chris/projects/unison`)
- The app can be built as:
  - A native **Electron** app
  - A **browser-accessible local interface** for portability

## 🧩 TECH STACK
- UI: Electron + React (desktop) or Next.js (optional browser mode)
- Backend: Node.js
- iPhone Connectivity: `libimobiledevice`, `usbmuxd`, `libplist`, `idevicebackup2`, `idevicedebug`, `ffmpeg` (for voicemail), and custom Bluetooth/USB modules
- Database: SQLite (local, persistent, sync-ready)
- Logging & Storage: JSON + SQLite for full traceability
- CRM Integration: Placeholder for `crm-sync.js` (API pending)

---

## ✅ CORE PHASES — BREAK DOWN AND EXECUTE

### 📦 PHASE 1: CORE SETUP
- [ ] Scaffold the project folder structure
- [ ] Initialize Git, install Electron and dependencies
- [ ] Build `main.js` to launch the Electron app window
- [ ] Load React/HTML UI for the main panel
- [ ] Connect backend API to handle sync commands
- [ ] Set up local SQLite database with tables:
  - `conversations`
  - `contacts`
  - `call_logs`
  - `file_transfers`
  - `sync_status`

---

### 📱 PHASE 2: iPHONE CONNECTIVITY BRIDGE
- [ ] Set up `iphone-bridge.js` to interface with:
  - `ideviceinfo` (get device info)
  - `idevicepair` (trust the device)
  - `idevicesyslog` (listen for events)
  - `idevicebackup2` (pull message db)
- [ ] Parse iMessage/SMS database and sync into SQLite
- [ ] Live update when new message arrives (poll or log hook)

---

### 📇 PHASE 3: CONTACT SYNC
- [ ] Read `AddressBook.sqlitedb` from backup
- [ ] Parse and store contacts into `contacts` table
- [ ] Display all contacts in frontend (React UI)
- [ ] Enable searching, sorting, and phone/email visibility

---

### 💬 PHASE 4: MESSAGE CENTER ✅ WORKING!
- [x] ✅ **BREAKTHROUGH ACHIEVED**: Phone Link automation fully working!
- [x] ✅ Single-script PowerShell automation sends messages via Phone Link UI
- [x] ✅ Contact loading + message typing + sending in one seamless flow
- [x] ✅ Comprehensive behind-the-scenes logging for debugging
- [ ] Build messaging UI for viewing entire message history
- [ ] Organize by contact  
- [ ] Support viewing threads, emojis, images, attachments
- [ ] Create a "Forever Archive" mode — never delete synced threads
- [ ] Export conversations to PDF or plaintext
- [ ] Link conversations to CRM (prep for future sync)

**⚠️ CRITICAL: DO NOT MODIFY `WindowsUIAutomation.ts` - THE PHONE LINK AUTOMATION IS WORKING PERFECTLY!**

---

### 📞 PHASE 5: PHONE CALL SUPPORT
- [ ] Use `idevicediagnostics` or similar to detect incoming call status
- [ ] Display caller info using synced contacts
- [ ] Send outgoing call request to paired iPhone
- [ ] (Optional) Use microphone bridge to allow live conversation via PC
- [ ] Log every call in `call_logs` table
- [ ] UI: dialer, call log viewer, call notes

---

### 📂 PHASE 6: FILE TRANSFER
- [ ] Drag-and-drop interface for file transfer
- [ ] Use `ifuse` to mount iPhone filesystem
- [ ] Sync downloaded photos, documents, voicemails
- [ ] Log transfers in `file_transfers`
- [ ] Allow exporting files to specific folders

---

### ⚙️ PHASE 7: SETTINGS + CRM HOOK
- [ ] UI page for settings (themes, device name, auto-sync toggle)
- [ ] `crm-sync.js`: add placeholder to push synced data when CRM API is ready
- [ ] Create config file or database row for agent ID / CRM key

---

### 🌐 PHASE 8: DEPLOYMENT + LAUNCH
- [ ] Use `electron-builder` to package Windows EXE
- [ ] Test on real Windows environment (Chris’s PC)
- [ ] Include fallback browser UI if Electron fails
- [ ] Run periodic Git commits with tagged versioning

---

## 💡 AI AGENT BEHAVIOR (YOU, CLAUDE)
- Think in phases, plan file-by-file
- Write code directly to disk inside `src/`
- Use Git for commits (semantic commit messages)
- Always explain decisions before major changes
- Be resourceful: explore open-source tools that help
- Design for long-term maintainability
- Avoid hard dependencies on iCloud, Apple ID, or App Store

---

## ✅ NON-NEGOTIABLES
- Conversations must be **archived forever**
- Phone calls must be **fully integrated**
- Contacts must **auto-sync** on connection
- Data must be **stored locally and reliably**
- iPhone must work **flawlessly** with Windows through this app

---

## 🧪 OPTIONAL IDEAS
- Sync calendar events + reminders
- Show battery/connection status of iPhone in real time
- Enable screen mirroring or Find My iPhone preview
- AI-powered voice-to-text transcription of voicemails
- GPT assistant integration (summarize calls/messages)

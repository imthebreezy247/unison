# UnisonX - Advanced iPhone-Windows Integration

UnisonX is a powerful desktop application that seamlessly integrates your iPhone with Windows PC, providing comprehensive access to messages, contacts, call logs, and file management.

## 🚀 Features

- **Device Connection**: USB-based iPhone connectivity with auto-detection
- **Real-time Sync**: Automatic synchronization of contacts, messages, and call logs
- **Message Center**: Full access to SMS and iMessage history (Phase 4)
- **Contact Management**: Complete contact sync and management (Phase 3)
- **Call Integration**: Call logs and phone integration (Phase 5)
- **File Transfer**: Drag-and-drop file transfer between iPhone and PC (Phase 6)
- **Screen Mirroring**: High-quality iPhone screen mirroring (Phase 3)
- **Forever Archive**: Permanent storage of all conversations and call logs

## 🛠️ Tech Stack

- **Frontend**: Electron + React + TypeScript
- **Backend**: Node.js + Express
- **Database**: SQLite with better-sqlite3
- **Styling**: Tailwind CSS
- **Build System**: Vite + electron-builder

## 📋 Development Status

### Phase 1: Foundation & Infrastructure ✅ COMPLETED
- [x] Project structure with Electron + React
- [x] SQLite database with comprehensive schema
- [x] Main process with IPC communication
- [x] React UI framework with routing
- [x] Theme system (light/dark/system)
- [x] Device detection and management system
- [x] Logging and error handling

### Phase 2: USB-Based Device Communication (Next)
- [ ] libimobiledevice integration
- [ ] Device pairing and trust
- [ ] File system access
- [ ] Real-time device monitoring

### Phase 3: Contact Sync (Upcoming)
- [ ] Contact database parsing
- [ ] Contact management UI
- [ ] Search and organization

### Phase 4: Message Center (Upcoming)
- [ ] Message database access
- [ ] Conversation UI
- [ ] Message history and archiving

### Phase 5: Phone Integration (Upcoming)
- [ ] Call log access
- [ ] Incoming call notifications
- [ ] Call management

### Phase 6: File Transfer (Upcoming)
- [ ] Drag-and-drop interface
- [ ] File sync and management
- [ ] Progress tracking

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ 
- Windows 10/11
- iTunes or Apple Mobile Device Support installed
- iPhone with iOS 12+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd unison
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

### Building

```bash
# Build for development
npm run build

# Build Windows installer
npm run dist:win
```

## 🔧 Configuration

The application stores its configuration and database in the project directory:
- Database: `db/unisonx.db`
- Logs: Generated in the main directory
- Settings: Stored in the database

## 📊 Database Schema

The application uses SQLite with the following main tables:
- `contacts` - Contact information
- `messages` - SMS/iMessage history
- `call_logs` - Phone call records
- `file_transfers` - File transfer history
- `sync_status` - Synchronization status tracking

## 🎯 Architecture

```
src/
├── main/           # Electron main process
│   ├── database/   # Database management
│   ├── services/   # Core services
│   └── main.ts     # Main entry point
└── renderer/       # React frontend
    ├── components/ # UI components
    ├── context/    # React contexts
    ├── pages/      # Application pages
    └── main.tsx    # Renderer entry point
```

## 🤝 Contributing

This is currently a private development project. Please follow the established patterns and coding standards.

## 📄 License

MIT License - See LICENSE file for details

## 🔒 Privacy & Security

UnisonX processes all data locally on your PC. No data is transmitted to external servers unless explicitly configured for CRM integration (Phase 8).

---

**Status**: Phase 1 Complete - Ready for Phase 2 Implementation
**Version**: 1.0.0
**Platform**: Windows 10/11

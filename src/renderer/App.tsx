import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { TitleBar } from './components/layout/TitleBar';
import { Dashboard } from './pages/Dashboard';
import { Messages } from './pages/Messages';
import { Contacts } from './pages/Contacts';
import { CallLogs } from './pages/CallLogs';
import { FileManager } from './pages/FileManager';
import { Settings } from './pages/Settings';
import { DeviceConnection } from './pages/DeviceConnection';
import { ConnectionProvider } from './context/ConnectionContext';
import { ThemeProvider } from './context/ThemeContext';

const App: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ThemeProvider>
      <ConnectionProvider>
        <div className="app-container h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
          {/* Custom Title Bar */}
          <TitleBar />
          
          <div className="app-content flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <Sidebar 
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            
            {/* Main Content */}
            <main className="main-content flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/device" element={<DeviceConnection />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/calls" element={<CallLogs />} />
                <Route path="/files" element={<FileManager />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
        </div>
      </ConnectionProvider>
    </ThemeProvider>
  );
};

export default App;
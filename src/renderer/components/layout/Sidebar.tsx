import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Smartphone, 
  MessageSquare, 
  Users, 
  Phone, 
  FolderOpen, 
  Settings, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useConnection } from '../../context/ConnectionContext';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const { state } = useConnection();
  
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/device', icon: Smartphone, label: 'Device Connection' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/contacts', icon: Users, label: 'Contacts' },
    { path: '/calls', icon: Phone, label: 'Call Logs' },
    { path: '/files', icon: FolderOpen, label: 'File Manager' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className={`sidebar bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Smartphone size={16} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">UnisonX</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Connection Status */}
      {!collapsed && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              state.activeDevice?.connected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {state.activeDevice?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {state.activeDevice && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              {state.activeDevice.name}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active' : ''} ${
                    collapsed ? 'justify-center' : ''
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="ml-3">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-500">
            Version {window.unisonx?.system?.getVersion()}
          </div>
        </div>
      )}
    </div>
  );
};
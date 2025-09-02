import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, RefreshCw, Bell, Shield, 
  Sliders, Palette, Database, Download, Upload, Keyboard, 
  ExternalLink, Trash2, Plus, Edit
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SettingItem {
  id: string;
  category: string;
  setting_key: string;
  setting_value: any;
  setting_type: string;
  display_name: string;
  description: string;
  is_user_configurable: boolean;
}

interface Theme {
  id: string;
  theme_name: string;
  theme_type: string;
  color_scheme: string;
  is_built_in: boolean;
  is_active: boolean;
}

interface CrmIntegration {
  id: string;
  crm_provider: string;
  integration_name: string;
  api_endpoint: string;
  sync_enabled: boolean;
}

interface Backup {
  id: string;
  backup_name: string;
  backup_type: string;
  backup_size: number;
  created_at: string;
}

// CRM Integration Form Component
const CRMIntegrationForm: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadCRMConfig();
  }, []);

  const loadCRMConfig = async () => {
    try {
      const config = await window.unisonx?.crm?.getConfig();
      if (config) {
        setApiKey(config.apiKey || '');
        setApiEndpoint(config.apiEndpoint || '');
        setEnabled(config.enabled || false);
      }
    } catch (error) {
      console.error('Failed to load CRM config:', error);
    }
  };

  const saveCRMConfig = async () => {
    setLoading(true);
    try {
      await window.unisonx?.crm?.updateConfig({
        apiKey,
        apiEndpoint,
        enabled,
        autoSyncContacts: true,
        autoSyncMessages: true,
        campaignEnabled: false
      });
      setStatus('CRM configuration saved successfully!');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error('Failed to save CRM config:', error);
      setStatus('Failed to save CRM configuration');
      setTimeout(() => setStatus(''), 3000);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key
          </label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your CRM API key (e.g., ick_c4a513ea...)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Endpoint
          </label>
          <input
            type="text"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder="https://api.yourcrm.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable CRM Integration
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatically sync contacts and messages with your CRM
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={saveCRMConfig}
          disabled={loading || !apiKey}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
        
        {status && (
          <span className={`text-sm ${status.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
};

export const Settings: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('appearance');
  const [settings, setSettings] = useState<{ [key: string]: SettingItem[] }>({});
  const [themes, setThemes] = useState<Theme[]>([]);
  const [crmIntegrations, setCrmIntegrations] = useState<CrmIntegration[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [version, setVersion] = useState<string>('Loading...');

  useEffect(() => {
    loadSettingsData();
    loadVersion();
  }, []);

  const loadVersion = async () => {
    try {
      const versionInfo = await window.unisonx?.system?.getVersion();
      setVersion(versionInfo || 'Unknown');
    } catch (error) {
      console.error('Failed to load version:', error);
      setVersion('Unknown');
    }
  };

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      
      // Mock data for demonstration - replace with actual API calls when available
      const mockSettings = {
        appearance: [
          {
            id: 'theme_mode',
            category: 'appearance',
            setting_key: 'theme_mode',
            setting_value: 'auto',
            setting_type: 'string',
            display_name: 'Theme Mode',
            description: 'Light, dark, or automatic theme',
            is_user_configurable: true
          },
          {
            id: 'font_size',
            category: 'appearance',
            setting_key: 'font_size',
            setting_value: 14,
            setting_type: 'number',
            display_name: 'Font Size',
            description: 'Base font size in pixels',
            is_user_configurable: true
          }
        ],
        sync: [
          {
            id: 'auto_sync',
            category: 'sync',
            setting_key: 'auto_sync_enabled',
            setting_value: true,
            setting_type: 'boolean',
            display_name: 'Auto Sync',
            description: 'Automatically sync when device connects',
            is_user_configurable: true
          }
        ],
        notifications: [
          {
            id: 'show_notifications',
            category: 'notifications',
            setting_key: 'show_notifications',
            setting_value: true,
            setting_type: 'boolean',
            display_name: 'Show Notifications',
            description: 'Enable desktop notifications',
            is_user_configurable: true
          }
        ],
        privacy: [
          {
            id: 'analytics',
            category: 'privacy',
            setting_key: 'analytics_enabled',
            setting_value: false,
            setting_type: 'boolean',
            display_name: 'Analytics',
            description: 'Send anonymous usage analytics',
            is_user_configurable: true
          }
        ],
        advanced: [
          {
            id: 'debug_mode',
            category: 'advanced',
            setting_key: 'debug_mode',
            setting_value: false,
            setting_type: 'boolean',
            display_name: 'Debug Mode',
            description: 'Enable debug logging',
            is_user_configurable: true
          }
        ]
      };
      setSettings(mockSettings);
      
      // Mock themes
      const mockThemes = [
        {
          id: 'theme-light',
          theme_name: 'Light',
          theme_type: 'light',
          color_scheme: '{}',
          is_built_in: true,
          is_active: true
        },
        {
          id: 'theme-dark',
          theme_name: 'Dark',
          theme_type: 'dark',
          color_scheme: '{}',
          is_built_in: true,
          is_active: false
        }
      ];
      setThemes(mockThemes);
      
      // Mock CRM integrations and backups
      setCrmIntegrations([]);
      setBackups([]);
      
    } catch (error) {
      console.error('Failed to load settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (category: string, key: string, value: any) => {
    try {
      // Mock update - in real implementation, would use window.unisonx.settings.set
      console.log(`Setting ${category}.${key} = ${value}`);
      setSaveStatus('Setting updated (demo mode)');
      setTimeout(() => setSaveStatus(''), 3000);
      
      // Update local state
      setSettings(prev => ({
        ...prev,
        [category]: prev[category]?.map(setting => 
          setting.setting_key === key 
            ? { ...setting, setting_value: value }
            : setting
        ) || []
      }));
    } catch (error) {
      console.error('Failed to update setting:', error);
      setSaveStatus('Failed to save settings');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const { setTheme } = useTheme();
  
  const setActiveTheme = async (themeId: string) => {
    try {
      console.log(`Setting active theme: ${themeId}`);
      
      // Extract the actual theme name from the ID (e.g., "theme-dark" -> "dark")
      const themeName = themeId.replace('theme-', '') as 'light' | 'dark' | 'system';
      
      // Set the theme using the ThemeContext
      setTheme(themeName);
      
      // Update the local state
      setThemes(prev => prev.map(theme => ({
        ...theme,
        is_active: theme.id === themeId
      })));
    } catch (error) {
      console.error('Failed to set active theme:', error);
    }
  };

  const createBackup = async (backupType: string) => {
    try {
      console.log(`Creating ${backupType} backup`);
      setSaveStatus('Backup created (demo mode)');
      
      const newBackup = {
        id: `backup-${Date.now()}`,
        backup_name: `${backupType}_backup_${new Date().toISOString().split('T')[0]}`,
        backup_type: backupType,
        backup_size: Math.floor(Math.random() * 1000000) + 50000,
        created_at: new Date().toISOString()
      };
      setBackups(prev => [newBackup, ...prev]);
    } catch (error) {
      console.error('Failed to create backup:', error);
      setSaveStatus('Failed to create backup');
    }
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const restoreBackup = async (backupId: string) => {
    try {
      console.log(`Restoring backup: ${backupId}`);
      setSaveStatus('Backup restored (demo mode)');
    } catch (error) {
      console.error('Failed to restore backup:', error);
      setSaveStatus('Failed to restore backup');
    }
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const cleanupDatabase = async () => {
    try {
      setLoading(true);
      setSaveStatus('Cleaning up duplicate phone numbers...');
      
      const result = await window.unisonx?.database?.cleanupDuplicates();
      
      if (result?.success) {
        setSaveStatus(`Cleanup successful! Removed ${result.statsBefore?.duplicatePhoneNumbers || 0} duplicate numbers`);
      } else {
        setSaveStatus('Database cleanup completed');
      }
    } catch (error) {
      console.error('Failed to cleanup database:', error);
      setSaveStatus('Failed to cleanup database');
    } finally {
      setLoading(false);
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  const emergencyMessageCleanup = async () => {
    try {
      setLoading(true);
      setSaveStatus('🚨 Starting emergency message cleanup...');
      
      const result = await window.unisonx?.database?.emergencyMessageCleanup();
      
      if (result?.success) {
        setSaveStatus(`🧹 Emergency cleanup complete! Removed ${result.deletedCount} duplicate messages`);
      } else {
        setSaveStatus('Emergency cleanup failed: ' + result?.error);
      }
    } catch (error) {
      console.error('Failed to run emergency cleanup:', error);
      setSaveStatus('Emergency cleanup failed');
    } finally {
      setLoading(false);
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'sync', label: 'Synchronization', icon: RefreshCw },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'crm', label: 'CRM Integration', icon: ExternalLink },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'advanced', label: 'Advanced', icon: Sliders },
  ];

  const renderToggle = (setting: SettingItem, value: boolean) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input 
        type="checkbox" 
        className="sr-only peer" 
        checked={value}
        onChange={(e) => updateSetting(setting.category, setting.setting_key, e.target.checked)}
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
  );

  const renderNumberInput = (setting: SettingItem, value: number) => (
    <input
      type="number"
      value={value}
      onChange={(e) => updateSetting(setting.category, setting.setting_key, parseFloat(e.target.value))}
      className="w-20 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
    />
  );

  const renderColorInput = (setting: SettingItem, value: string) => (
    <input
      type="color"
      value={value}
      onChange={(e) => updateSetting(setting.category, setting.setting_key, e.target.value)}
      className="w-12 h-8 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
    />
  );

  const renderSettingControl = (setting: SettingItem) => {
    const value = setting.setting_value;
    
    switch (setting.setting_type) {
      case 'boolean':
        return renderToggle(setting, value);
      case 'number':
        return renderNumberInput(setting, value);
      case 'color':
        return renderColorInput(setting, value);
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateSetting(setting.category, setting.setting_key, e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="settings p-6 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <SettingsIcon size={24} />
          Settings
        </h1>
        {saveStatus && (
          <div className={`px-3 py-1 rounded-md text-sm ${
            saveStatus.includes('Failed') 
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
              : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
          }`}>
            {saveStatus}
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Palette size={20} />
                  Theme Selection
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {themes.map((themeItem) => (
                    <button
                      key={themeItem.id}
                      onClick={() => setActiveTheme(themeItem.id)}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        themeItem.is_active
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {themeItem.theme_name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {themeItem.theme_type} theme
                      </div>
                      {themeItem.is_built_in && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Built-in
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Appearance Settings */}
              {settings.appearance && (
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Appearance Options
                  </h3>
                  <div className="space-y-4">
                    {settings.appearance.map((setting) => (
                      <div key={setting.id} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {setting.display_name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {setting.description}
                          </div>
                        </div>
                        {renderSettingControl(setting)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sync Settings */}
          {activeTab === 'sync' && settings.sync && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <RefreshCw size={20} />
                Synchronization Settings
              </h2>
              <div className="space-y-4">
                {settings.sync.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {setting.display_name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {setting.description}
                      </div>
                    </div>
                    {renderSettingControl(setting)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && settings.notifications && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Bell size={20} />
                Notification Settings
              </h2>
              <div className="space-y-4">
                {settings.notifications.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {setting.display_name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {setting.description}
                      </div>
                    </div>
                    {renderSettingControl(setting)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Settings */}
          {activeTab === 'privacy' && settings.privacy && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Shield size={20} />
                Privacy & Security
              </h2>
              <div className="space-y-4">
                {settings.privacy.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {setting.display_name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {setting.description}
                      </div>
                    </div>
                    {renderSettingControl(setting)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CRM Integration */}
          {activeTab === 'crm' && (
            <div className="space-y-6">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <ExternalLink size={20} />
                    CRM Integration
                  </h2>
                </div>
                
                <CRMIntegrationForm />
              </div>
            </div>
          )}

          {/* Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Keyboard size={20} />
                Keyboard Shortcuts
              </h2>
              <p className="text-gray-600 dark:text-gray-400">Feature coming soon...</p>
            </div>
          )}

          {/* Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Database size={20} />
                  Database Cleanup
                </h2>
                <div className="mb-6">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Clean up duplicate entries and fix the 18K+ message duplication issue.
                  </p>
                  <div className="flex gap-3 mb-4">
                    <button 
                      onClick={cleanupDatabase}
                      className="btn-secondary flex items-center gap-2"
                      disabled={loading}
                    >
                      <Trash2 size={16} />
                      {loading ? 'Cleaning...' : 'Cleanup Duplicate Numbers'}
                    </button>
                    <button 
                      onClick={emergencyMessageCleanup}
                      className="btn-danger flex items-center gap-2"
                      disabled={loading}
                    >
                      🚨
                      {loading ? 'Processing...' : 'Emergency Message Cleanup'}
                    </button>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Use Emergency Cleanup if you have 18K+ duplicate messages.</strong> This will remove all duplicate messages, keeping only the oldest copy of each unique message.
                    </p>
                  </div>
                  {saveStatus && (
                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                      {saveStatus}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Database size={20} />
                  Create Backup
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button 
                    onClick={() => createBackup('full')}
                    className="btn-outline flex items-center justify-center gap-2 p-4"
                  >
                    <Download size={16} />
                    Full Backup
                  </button>
                  <button 
                    onClick={() => createBackup('settings')}
                    className="btn-outline flex items-center justify-center gap-2 p-4"
                  >
                    <Download size={16} />
                    Settings Only
                  </button>
                  <button 
                    onClick={() => createBackup('data')}
                    className="btn-outline flex items-center justify-center gap-2 p-4"
                  >
                    <Download size={16} />
                    Data Only
                  </button>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Available Backups
                </h3>
                {backups.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Database size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No backups found</p>
                    <p className="text-sm">Create a backup to restore your settings and data</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {backups.map((backup) => (
                      <div key={backup.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {backup.backup_name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {backup.backup_type} • {(backup.backup_size / 1024).toFixed(1)} KB • {new Date(backup.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => restoreBackup(backup.id)}
                            className="btn-outline-sm flex items-center gap-1"
                          >
                            <Upload size={14} />
                            Restore
                          </button>
                          <button className="text-red-600 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Keyboard size={20} />
                Keyboard Shortcuts
              </h2>
              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Customize keyboard shortcuts for quick access to UnisonX features
                </div>
                <div className="space-y-3">
                  {[
                    { action: 'New Message', shortcut: 'Ctrl+N', category: 'Messages' },
                    { action: 'Search', shortcut: 'Ctrl+F', category: 'Navigation' },
                    { action: 'Refresh', shortcut: 'F5', category: 'Navigation' },
                    { action: 'Settings', shortcut: 'Ctrl+,', category: 'Navigation' },
                    { action: 'Quit', shortcut: 'Ctrl+Q', category: 'Navigation' }
                  ].map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {shortcut.action}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {shortcut.category}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">
                          {shortcut.shortcut}
                        </kbd>
                        <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                          <Edit size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          {activeTab === 'advanced' && settings.advanced && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Sliders size={20} />
                Advanced Settings
              </h2>
              <div className="space-y-4">
                {settings.advanced.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {setting.display_name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {setting.description}
                      </div>
                    </div>
                    {renderSettingControl(setting)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* About Section */}
      <div className="mt-8 card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          About UnisonX
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Version</span>
              <span className="font-medium">{version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Platform</span>
              <span className="font-medium">Windows</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Database</span>
              <span className="font-medium">SQLite</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Build</span>
              <span className="font-medium">Production</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Architecture</span>
              <span className="font-medium">x64</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Node.js</span>
              <span className="font-medium">{window.unisonx?.system?.getVersions?.()?.node || 'Unknown'}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Electron</span>
              <span className="font-medium">{window.unisonx?.system?.getVersions?.()?.electron || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Chrome</span>
              <span className="font-medium">{window.unisonx?.system?.getVersions?.()?.chrome || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">License</span>
              <span className="font-medium">MIT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
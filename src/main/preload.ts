import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
interface UnisonXAPI {
  // Database operations
  db: {
    query: (query: string, params?: any[]) => Promise<any[]>;
    run: (query: string, params?: any[]) => Promise<any>;
  };

  // Device management
  device: {
    scan: () => Promise<any[]>;
    connect: (deviceId: string) => Promise<boolean>;
    disconnect: (deviceId: string) => Promise<boolean>;
    pair: (deviceId: string) => Promise<boolean>;
    getStatus: (deviceId: string) => Promise<any>;
    getFiles: (deviceId: string, path?: string) => Promise<any[]>;
  };

  // File operations
  file: {
    transfer: (source: string, destination: string) => Promise<boolean>;
    list: (path: string) => Promise<any[]>;
    delete: (path: string) => Promise<boolean>;
  };

  // Contact operations
  contacts: {
    sync: (deviceId: string, backupPath?: string) => Promise<any>;
    search: (query: string, filters?: any) => Promise<any[]>;
    update: (contact: any) => Promise<void>;
    delete: (contactId: string) => Promise<void>;
    favorite: (contactId: string) => Promise<void>;
    unfavorite: (contactId: string) => Promise<void>;
    getFavorites: () => Promise<any[]>;
    getGroups: () => Promise<any[]>;
    createGroup: (groupData: { name: string; color: string }) => Promise<any>;
    addToGroup: (contactId: string, groupId: string) => Promise<boolean>;
    removeFromGroup: (contactId: string, groupId: string) => Promise<boolean>;
    getGroupMembers: (groupId: string) => Promise<any[]>;
    exportCSV: () => Promise<any>;
    exportVCard: () => Promise<any>;
    importCSV: () => Promise<any>;
    importVCard: () => Promise<any>;
    exportSelected: (contactIds: string[], format: 'csv' | 'vcard') => Promise<any>;
  };

  // Message operations
  messages: {
    sync: (deviceId: string, backupPath?: string) => Promise<any>;
    getThreads: (limit?: number, offset?: number) => Promise<any[]>;
    getThreadMessages: (threadId: string, limit?: number, offset?: number) => Promise<any[]>;
    markAsRead: (threadId: string) => Promise<boolean>;
    send: (threadId: string, content: string, messageType?: 'sms' | 'imessage') => Promise<string>;
    search: (query: string, limit?: number) => Promise<any[]>;
    getStats: () => Promise<any>;
    getDetailedStats: () => Promise<any>;
    export: (threadId?: string, format?: 'json' | 'csv' | 'txt') => Promise<any>;
    archiveThread: (threadId: string, archived?: boolean) => Promise<boolean>;
    importBackup: (deviceId?: string) => Promise<any>;
    createThread: (phoneNumber: string) => Promise<any>;
  };

  // Call log operations
  calls: {
    sync: (deviceId: string, backupPath?: string) => Promise<any>;
    getLogs: (limit?: number, offset?: number, filters?: any) => Promise<any[]>;
    initiate: (phoneNumber: string, callType?: 'voice' | 'video' | 'facetime') => Promise<string>;
    end: (callId: string) => Promise<void>;
    getActive: () => Promise<any[]>;
    addNotes: (callId: string, notes: string) => Promise<void>;
    getStatistics: () => Promise<any>;
    export: (format?: 'json' | 'csv' | 'txt') => Promise<any>;
  };

  // File manager operations
  files: {
    startTransfer: (transferRequest: any) => Promise<string>;
    getTransfers: (limit?: number, offset?: number, filters?: any) => Promise<any[]>;
    getActiveTransfers: () => Promise<any[]>;
    pauseTransfer: (transferId: string) => Promise<void>;
    resumeTransfer: (transferId: string) => Promise<void>;
    cancelTransfer: (transferId: string) => Promise<void>;
    getStatistics: () => Promise<any>;
    export: (format?: 'json' | 'csv' | 'txt') => Promise<any>;
    createFolder: (folderData: any) => Promise<string>;
    getFolders: () => Promise<any[]>;
    addToFolder: (transferId: string, folderId: string) => Promise<void>;
  };

  // Settings operations
  settings: {
    get: (category: string, key: string, defaultValue?: any) => Promise<any>;
    set: (category: string, key: string, value: any, settingType?: string) => Promise<void>;
    getCategory: (category: string) => Promise<any>;
    getAll: () => Promise<any>;
  };

  // Preferences operations
  preferences: {
    get: (group: string, key: string, defaultValue?: any) => Promise<any>;
    set: (group: string, key: string, value: any, isSynced?: boolean) => Promise<void>;
  };

  // Theme operations
  themes: {
    getAll: () => Promise<any[]>;
    getActive: () => Promise<any>;
    setActive: (themeId: string) => Promise<void>;
    createCustom: (themeData: any) => Promise<string>;
  };

  // CRM operations
  crm: {
    getIntegrations: () => Promise<any[]>;
    createIntegration: (integrationData: any) => Promise<string>;
    updateIntegration: (integrationId: string, updateData: any) => Promise<void>;
  };

  // Backup operations
  backup: {
    create: (backupType: string, options?: any) => Promise<any>;
    restore: (backupId: string) => Promise<any>;
    getAll: () => Promise<any[]>;
  };

  // System operations
  system: {
    minimize: () => void;
    close: () => void;
    quit: () => void;
    getVersion: () => Promise<string>;
  };

  // Version information
  versions: {
    node: string;
    electron: string;
    chrome: string;
  };

  // Logging
  log: {
    info: (message: string) => void;
    error: (message: string, error?: any) => void;
  };

  // Event listeners
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
}

// Expose the API to the renderer process
const api: UnisonXAPI = {
  // Database operations
  db: {
    query: (query: string, params?: any[]) => ipcRenderer.invoke('db:query', query, params),
    run: (query: string, params?: any[]) => ipcRenderer.invoke('db:run', query, params),
  },

  // Device management
  device: {
    scan: () => ipcRenderer.invoke('device:scan'),
    connect: (deviceId: string) => ipcRenderer.invoke('device:connect', deviceId),
    disconnect: (deviceId: string) => ipcRenderer.invoke('device:disconnect', deviceId),
    pair: (deviceId: string) => ipcRenderer.invoke('device:pair', deviceId),
    getStatus: (deviceId: string) => ipcRenderer.invoke('device:status', deviceId),
    getFiles: (deviceId: string, path?: string) => ipcRenderer.invoke('device:files', deviceId, path),
  },

  // File operations
  file: {
    transfer: (source: string, destination: string) => ipcRenderer.invoke('file:transfer', source, destination),
    list: (path: string) => ipcRenderer.invoke('file:list', path),
    delete: (path: string) => ipcRenderer.invoke('file:delete', path),
  },

  // Contact operations
  contacts: {
    sync: (deviceId: string, backupPath?: string) => ipcRenderer.invoke('contacts:sync', deviceId, backupPath),
    search: (query: string, filters?: any) => ipcRenderer.invoke('contacts:search', query, filters),
    update: (contact: any) => ipcRenderer.invoke('contacts:update', contact),
    delete: (contactId: string) => ipcRenderer.invoke('contacts:delete', contactId),
    favorite: (contactId: string) => ipcRenderer.invoke('contacts:favorite', contactId),
    unfavorite: (contactId: string) => ipcRenderer.invoke('contacts:unfavorite', contactId),
    getFavorites: () => ipcRenderer.invoke('contacts:get-favorites'),
    getGroups: () => ipcRenderer.invoke('contacts:get-groups'),
    createGroup: (groupData: { name: string; color: string }) => ipcRenderer.invoke('contacts:create-group', groupData),
    addToGroup: (contactId: string, groupId: string) => ipcRenderer.invoke('contacts:add-to-group', contactId, groupId),
    removeFromGroup: (contactId: string, groupId: string) => ipcRenderer.invoke('contacts:remove-from-group', contactId, groupId),
    getGroupMembers: (groupId: string) => ipcRenderer.invoke('contacts:get-group-members', groupId),
    exportCSV: () => ipcRenderer.invoke('contacts:export-csv'),
    exportVCard: () => ipcRenderer.invoke('contacts:export-vcard'),
    importCSV: () => ipcRenderer.invoke('contacts:import-csv'),
    importVCard: () => ipcRenderer.invoke('contacts:import-vcard'),
    exportSelected: (contactIds: string[], format: 'csv' | 'vcard') => ipcRenderer.invoke('contacts:export-selected', contactIds, format),
  },

  // Message operations
  messages: {
    sync: (deviceId: string, backupPath?: string) => ipcRenderer.invoke('messages:sync', deviceId, backupPath),
    getThreads: (limit?: number, offset?: number) => ipcRenderer.invoke('messages:get-threads', limit, offset),
    getThreadMessages: (threadId: string, limit?: number, offset?: number) => ipcRenderer.invoke('messages:get-thread-messages', threadId, limit, offset),
    markAsRead: (threadId: string) => ipcRenderer.invoke('messages:mark-as-read', threadId),
    send: (threadId: string, content: string, messageType?: 'sms' | 'imessage') => ipcRenderer.invoke('messages:send', threadId, content, messageType),
    search: (query: string, limit?: number) => ipcRenderer.invoke('messages:search', query, limit),
    getStats: () => ipcRenderer.invoke('messages:get-stats'),
    getDetailedStats: () => ipcRenderer.invoke('messages:get-detailed-stats'),
    export: (threadId?: string, format?: 'json' | 'csv' | 'txt') => ipcRenderer.invoke('messages:export', threadId, format),
    archiveThread: (threadId: string, archived?: boolean) => ipcRenderer.invoke('messages:archive-thread', threadId, archived),
    importBackup: (deviceId?: string) => ipcRenderer.invoke('messages:import-backup', deviceId),
    createThread: (phoneNumber: string) => ipcRenderer.invoke('messages:create-thread', phoneNumber),
  },

  // Call log operations
  calls: {
    sync: (deviceId: string, backupPath?: string) => ipcRenderer.invoke('calls:sync', deviceId, backupPath),
    getLogs: (limit?: number, offset?: number, filters?: any) => ipcRenderer.invoke('calls:get-logs', limit, offset, filters),
    initiate: (phoneNumber: string, callType?: 'voice' | 'video' | 'facetime') => ipcRenderer.invoke('calls:initiate', phoneNumber, callType),
    end: (callId: string) => ipcRenderer.invoke('calls:end', callId),
    getActive: () => ipcRenderer.invoke('calls:get-active'),
    addNotes: (callId: string, notes: string) => ipcRenderer.invoke('calls:add-notes', callId, notes),
    getStatistics: () => ipcRenderer.invoke('calls:get-statistics'),
    export: (format?: 'json' | 'csv' | 'txt') => ipcRenderer.invoke('calls:export', format),
  },

  // File manager operations
  files: {
    startTransfer: (transferRequest: any) => ipcRenderer.invoke('files:start-transfer', transferRequest),
    getTransfers: (limit?: number, offset?: number, filters?: any) => ipcRenderer.invoke('files:get-transfers', limit, offset, filters),
    getActiveTransfers: () => ipcRenderer.invoke('files:get-active-transfers'),
    pauseTransfer: (transferId: string) => ipcRenderer.invoke('files:pause-transfer', transferId),
    resumeTransfer: (transferId: string) => ipcRenderer.invoke('files:resume-transfer', transferId),
    cancelTransfer: (transferId: string) => ipcRenderer.invoke('files:cancel-transfer', transferId),
    getStatistics: () => ipcRenderer.invoke('files:get-statistics'),
    export: (format?: 'json' | 'csv' | 'txt') => ipcRenderer.invoke('files:export', format),
    createFolder: (folderData: any) => ipcRenderer.invoke('files:create-folder', folderData),
    getFolders: () => ipcRenderer.invoke('files:get-folders'),
    addToFolder: (transferId: string, folderId: string) => ipcRenderer.invoke('files:add-to-folder', transferId, folderId),
  },

  // Settings and preferences operations
  settings: {
    get: (category: string, key: string, defaultValue?: any) => ipcRenderer.invoke('settings:get', category, key, defaultValue),
    set: (category: string, key: string, value: any, settingType?: string) => ipcRenderer.invoke('settings:set', category, key, value, settingType),
    getCategory: (category: string) => ipcRenderer.invoke('settings:get-category', category),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
  },

  preferences: {
    get: (group: string, key: string, defaultValue?: any) => ipcRenderer.invoke('preferences:get', group, key, defaultValue),
    set: (group: string, key: string, value: any, isSynced?: boolean) => ipcRenderer.invoke('preferences:set', group, key, value, isSynced),
  },

  themes: {
    getAll: () => ipcRenderer.invoke('themes:get-all'),
    getActive: () => ipcRenderer.invoke('themes:get-active'),
    setActive: (themeId: string) => ipcRenderer.invoke('themes:set-active', themeId),
    createCustom: (themeData: any) => ipcRenderer.invoke('themes:create-custom', themeData),
  },

  crm: {
    getIntegrations: () => ipcRenderer.invoke('crm:get-integrations'),
    createIntegration: (integrationData: any) => ipcRenderer.invoke('crm:create-integration', integrationData),
    updateIntegration: (integrationId: string, updateData: any) => ipcRenderer.invoke('crm:update-integration', integrationId, updateData),
  },

  backup: {
    create: (backupType: string, options?: any) => ipcRenderer.invoke('backup:create', backupType, options),
    restore: (backupId: string) => ipcRenderer.invoke('backup:restore', backupId),
    getAll: () => ipcRenderer.invoke('backup:get-all'),
  },

  // System operations
  system: {
    minimize: () => ipcRenderer.invoke('system:minimize'),
    close: () => ipcRenderer.invoke('system:close'),
    quit: () => ipcRenderer.invoke('system:quit'),
    getVersion: () => ipcRenderer.invoke('system:get-version'),
  },

  // Version information
  versions: (() => {
    try {
      const versions = ipcRenderer.sendSync('system:get-versions');
      return {
        node: versions?.node || 'Unknown',
        electron: versions?.electron || 'Unknown',
        chrome: versions?.chrome || 'Unknown',
      };
    } catch (error) {
      return {
        node: 'Unknown',
        electron: 'Unknown',
        chrome: 'Unknown',
      };
    }
  })(),

  // Logging
  log: {
    info: (message: string) => ipcRenderer.invoke('log:info', message),
    error: (message: string, error?: any) => ipcRenderer.invoke('log:error', message, error),
  },

  // Event listeners
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// Expose the API
contextBridge.exposeInMainWorld('unisonx', api);

// Type declaration for TypeScript
declare global {
  interface Window {
    unisonx: UnisonXAPI;
  }
}
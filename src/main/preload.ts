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
  };

  // System operations
  system: {
    minimize: () => void;
    close: () => void;
    quit: () => void;
    getVersion: () => string;
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
  },

  // System operations
  system: {
    minimize: () => ipcRenderer.invoke('system:minimize'),
    close: () => ipcRenderer.invoke('system:close'),
    quit: () => ipcRenderer.invoke('system:quit'),
    getVersion: () => process.env.npm_package_version || '1.0.0',
  },

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
    ipcRenderer.removeListener(channel, callback);
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
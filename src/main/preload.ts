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
    getStatus: (deviceId: string) => Promise<any>;
  };

  // File operations
  file: {
    transfer: (source: string, destination: string) => Promise<boolean>;
    list: (path: string) => Promise<any[]>;
    delete: (path: string) => Promise<boolean>;
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
    getStatus: (deviceId: string) => ipcRenderer.invoke('device:status', deviceId),
  },

  // File operations
  file: {
    transfer: (source: string, destination: string) => ipcRenderer.invoke('file:transfer', source, destination),
    list: (path: string) => ipcRenderer.invoke('file:list', path),
    delete: (path: string) => ipcRenderer.invoke('file:delete', path),
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
// Window type declarations for UnisonX API
declare global {
  interface Window {
    unisonx: {
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

      // Database operations
      database: {
        cleanupDuplicates: () => Promise<any>;
        emergencyMessageCleanup: () => Promise<any>;
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
    };
  }
}

export {};
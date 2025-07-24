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
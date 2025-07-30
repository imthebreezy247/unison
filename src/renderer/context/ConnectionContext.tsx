import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Device {
  id: string;
  name: string;
  type: 'iPhone' | 'iPad';
  model: string;
  osVersion: string;
  connected: boolean;
  batteryLevel?: number;
  connectionType: 'usb' | 'wifi' | 'disconnected';
  lastSeen: string;
  trusted?: boolean;
  paired?: boolean;
  serialNumber?: string;
}

export interface ConnectionState {
  devices: Device[];
  activeDevice: Device | null;
  isScanning: boolean;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncProgress: number;
}

interface ConnectionContextType {
  state: ConnectionState;
  scanForDevices: () => Promise<void>;
  connectDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: (deviceId: string) => Promise<boolean>;
  startSync: () => Promise<void>;
  setActiveDevice: (device: Device | null) => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
};

interface ConnectionProviderProps {
  children: ReactNode;
}

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({ children }) => {
  const [state, setState] = useState<ConnectionState>({
    devices: [],
    activeDevice: null,
    isScanning: false,
    lastSyncTime: null,
    syncStatus: 'idle',
    syncProgress: 0,
  });

  // Initialize connection monitoring
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        await scanForDevices();
      } catch (error) {
        console.error('Failed to initialize connection:', error);
        window.unisonx?.log?.error('Failed to initialize connection', error);
      }
    };

    initializeConnection();

    // Set up real-time device event listeners
    const handleDevicesUpdated = (devices: any[]) => {
      setState(prev => ({
        ...prev,
        devices: devices.map((device: any) => ({
          id: device.id,
          name: device.name || 'Unknown iPhone',
          type: device.type || 'iPhone',
          model: device.model || 'Unknown Model',
          osVersion: device.osVersion || 'Unknown',
          connected: device.connected || false,
          batteryLevel: device.batteryLevel,
          connectionType: device.connectionType || 'disconnected',
          lastSeen: device.lastSeen || new Date().toISOString(),
          trusted: device.trusted,
          paired: device.paired,
          serialNumber: device.serialNumber,
        })),
        isScanning: false,
      }));
      window.unisonx?.log?.info(`Real-time update: Found ${devices.length} devices`);
    };

    const handleDeviceConnected = (device: any) => {
      setState(prev => ({
        ...prev,
        devices: prev.devices.map(d => 
          d.id === device.id ? { ...d, connected: true, connectionType: 'usb' } : d
        ),
        activeDevice: device,
      }));
      window.unisonx?.log?.info(`Device connected: ${device.name}`);
    };

    const handleDeviceDisconnected = (device: any) => {
      setState(prev => ({
        ...prev,
        devices: prev.devices.map(d => 
          d.id === device.id ? { ...d, connected: false, connectionType: 'disconnected' } : d
        ),
        activeDevice: prev.activeDevice?.id === device.id ? null : prev.activeDevice,
      }));
      window.unisonx?.log?.info(`Device disconnected: ${device.name}`);
    };

    // Set up periodic device scanning as fallback
    const scanInterval = setInterval(scanForDevices, 30000); // Scan every 30 seconds as fallback

    // Listen for device events
    window.unisonx?.on('devices-updated', handleDevicesUpdated);
    window.unisonx?.on('device-connected', handleDeviceConnected);
    window.unisonx?.on('device-disconnected', handleDeviceDisconnected);

    return () => {
      clearInterval(scanInterval);
      window.unisonx?.off('devices-updated', handleDevicesUpdated);
      window.unisonx?.off('device-connected', handleDeviceConnected);
      window.unisonx?.off('device-disconnected', handleDeviceDisconnected);
    };
  }, []);

  const scanForDevices = async (): Promise<void> => {
    if (state.isScanning) return;

    setState(prev => ({ ...prev, isScanning: true }));

    try {
      const devices = await window.unisonx?.device?.scan() || [];
      
      setState(prev => ({
        ...prev,
        devices: devices.map((device: any) => ({
          id: device.id,
          name: device.name || 'Unknown iPhone',
          type: device.type || 'iPhone',
          model: device.model || 'Unknown Model',
          osVersion: device.osVersion || 'Unknown',
          connected: device.connected || false,
          batteryLevel: device.batteryLevel,
          connectionType: device.connectionType || 'disconnected',
          lastSeen: device.lastSeen || new Date().toISOString(),
        })),
        isScanning: false,
      }));

      window.unisonx?.log?.info(`Found ${devices.length} devices`);
    } catch (error) {
      console.error('Device scan failed:', error);
      window.unisonx?.log?.error('Device scan failed', error);
      setState(prev => ({ ...prev, isScanning: false }));
    }
  };

  const connectDevice = async (deviceId: string): Promise<boolean> => {
    try {
      const success = await window.unisonx?.device?.connect(deviceId);
      
      if (success) {
        setState(prev => ({
          ...prev,
          devices: prev.devices.map(device =>
            device.id === deviceId
              ? { ...device, connected: true, connectionType: 'usb', lastSeen: new Date().toISOString() }
              : device
          ),
          activeDevice: prev.devices.find(d => d.id === deviceId) || null,
        }));

        window.unisonx?.log?.info(`Successfully connected to device: ${deviceId}`);
        return true;
      } else {
        window.unisonx?.log?.error(`Failed to connect to device: ${deviceId}`);
        return false;
      }
    } catch (error) {
      console.error('Device connection failed:', error);
      window.unisonx?.log?.error('Device connection failed', error);
      return false;
    }
  };

  const disconnectDevice = async (deviceId: string): Promise<boolean> => {
    try {
      const success = await window.unisonx?.device?.disconnect(deviceId);
      
      if (success) {
        setState(prev => ({
          ...prev,
          devices: prev.devices.map(device =>
            device.id === deviceId
              ? { ...device, connected: false, connectionType: 'disconnected' }
              : device
          ),
          activeDevice: prev.activeDevice?.id === deviceId ? null : prev.activeDevice,
        }));

        window.unisonx?.log?.info(`Successfully disconnected from device: ${deviceId}`);
        return true;
      } else {
        window.unisonx?.log?.error(`Failed to disconnect from device: ${deviceId}`);
        return false;
      }
    } catch (error) {
      console.error('Device disconnection failed:', error);
      window.unisonx?.log?.error('Device disconnection failed', error);
      return false;
    }
  };

  const startSync = async (): Promise<void> => {
    if (!state.activeDevice) {
      throw new Error('No active device to sync with');
    }

    setState(prev => ({ ...prev, syncStatus: 'syncing', syncProgress: 0 }));

    try {
      // Simulate sync progress
      const syncSteps = ['contacts', 'messages', 'calls', 'files'];
      
      for (let i = 0; i < syncSteps.length; i++) {
        const step = syncSteps[i];
        setState(prev => ({ ...prev, syncProgress: ((i + 1) / syncSteps.length) * 100 }));
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        window.unisonx?.log?.info(`Synced ${step} data`);
      }

      setState(prev => ({
        ...prev,
        syncStatus: 'success',
        syncProgress: 100,
        lastSyncTime: new Date().toISOString(),
      }));

      // Reset sync status after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, syncStatus: 'idle', syncProgress: 0 }));
      }, 3000);

    } catch (error) {
      console.error('Sync failed:', error);
      window.unisonx?.log?.error('Sync failed', error);
      setState(prev => ({ ...prev, syncStatus: 'error', syncProgress: 0 }));
      
      // Reset error status after 5 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, syncStatus: 'idle' }));
      }, 5000);
    }
  };

  const setActiveDevice = (device: Device | null): void => {
    setState(prev => ({ ...prev, activeDevice: device }));
  };

  const contextValue: ConnectionContextType = {
    state,
    scanForDevices,
    connectDevice,
    disconnectDevice,
    startSync,
    setActiveDevice,
  };

  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
    </ConnectionContext.Provider>
  );
};
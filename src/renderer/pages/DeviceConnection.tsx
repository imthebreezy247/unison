import React, { useState } from 'react';
import { 
  Smartphone, 
  Wifi, 
  Usb, 
  Search, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Battery,
  HardDrive,
  FolderOpen
} from 'lucide-react';
import { useConnection } from '../context/ConnectionContext';

export const DeviceConnection: React.FC = () => {
  const { state, scanForDevices, connectDevice, disconnectDevice } = useConnection();
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  const handleConnect = async (deviceId: string) => {
    await connectDevice(deviceId);
  };

  const handleDisconnect = async (deviceId: string) => {
    await disconnectDevice(deviceId);
  };

  const handlePairDevice = async (deviceId: string) => {
    try {
      const success = await window.unisonx?.device?.pair(deviceId);
      if (success) {
        window.unisonx?.log?.info(`Device paired successfully: ${deviceId}`);
        // Refresh device list
        await scanForDevices();
      }
    } catch (error) {
      window.unisonx?.log?.error('Failed to pair device', error);
    }
  };

  const handleViewFiles = async (deviceId: string) => {
    try {
      const files = await window.unisonx?.device?.getFiles(deviceId);
      console.log('Device files:', files);
      // In a real implementation, would open file browser
    } catch (error) {
      window.unisonx?.log?.error('Failed to get device files', error);
    }
  };

  const getConnectionIcon = (connectionType: string) => {
    switch (connectionType) {
      case 'usb':
        return <Usb size={16} className="text-blue-500" />;
      case 'wifi':
        return <Wifi size={16} className="text-green-500" />;
      default:
        return <XCircle size={16} className="text-red-500" />;
    }
  };

  const getStatusColor = (connected: boolean) => {
    return connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getTrustIcon = (trusted: boolean) => {
    return trusted ? 
      <ShieldCheck size={16} className="text-green-500" /> : 
      <Shield size={16} className="text-yellow-500" />;
  };


  return (
    <div className="device-connection p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Device Connection
        </h1>
        <button
          onClick={scanForDevices}
          disabled={state.isScanning}
          className="button-primary flex items-center space-x-2"
        >
          <Search size={16} className={state.isScanning ? 'animate-spin' : ''} />
          <span>{state.isScanning ? 'Scanning...' : 'Scan for Devices'}</span>
        </button>
      </div>

      {/* Connection Instructions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          How to Connect Your iPhone
        </h2>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Connect via USB
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Use a Lightning to USB cable to connect your iPhone to this PC
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Trust This Computer
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                When prompted on your iPhone, tap "Trust" to allow this PC to access your device
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Start Syncing
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Once connected, UnisonX will automatically sync your contacts, messages, and files
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Available Devices */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Available Devices
          </h2>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <RefreshCw size={14} />
            <span>Auto-refresh every 10s</span>
          </div>
        </div>

        {state.isScanning && state.devices.length === 0 ? (
          <div className="text-center py-8">
            <div className="loading-spinner mx-auto mb-4"></div>
            <div className="text-gray-600 dark:text-gray-400">
              Scanning for devices...
            </div>
          </div>
        ) : state.devices.length === 0 ? (
          <div className="text-center py-8">
            <Smartphone size={48} className="mx-auto text-gray-400 mb-4" />
            <div className="text-gray-600 dark:text-gray-400 mb-2">
              No devices found
            </div>
            <div className="text-sm text-gray-500">
              Make sure your iPhone is connected and trusted
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {state.devices.map((device) => (
              <div
                key={device.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                      <Smartphone size={24} className="text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {device.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {device.model} • iOS {device.osVersion}
                      </div>
                      <div className="flex items-center space-x-3 mt-2">
                        <div className="flex items-center space-x-1">
                          {getConnectionIcon(device.connectionType)}
                          <span className="text-xs text-gray-500">
                            {device.connectionType.toUpperCase()}
                          </span>
                        </div>
                        
                        {device.trusted !== undefined && (
                          <div className="flex items-center space-x-1">
                            {getTrustIcon(device.trusted)}
                            <span className="text-xs text-gray-500">
                              {device.trusted ? 'Trusted' : 'Not Trusted'}
                            </span>
                          </div>
                        )}
                        
                        {device.batteryLevel && (
                          <div className="flex items-center space-x-1">
                            <Battery size={14} className="text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {device.batteryLevel}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {device.connected ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                      <span className={`text-sm font-medium ${getStatusColor(device.connected)}`}>
                        {device.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {!device.trusted && !device.connected && (
                        <button
                          onClick={() => handlePairDevice(device.id)}
                          className="px-3 py-1 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md"
                        >
                          Pair
                        </button>
                      )}
                      
                      {device.connected && (
                        <button
                          onClick={() => handleViewFiles(device.id)}
                          className="px-3 py-1 text-sm button-secondary flex items-center space-x-1"
                        >
                          <FolderOpen size={14} />
                          <span>Files</span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => device.connected ? handleDisconnect(device.id) : handleConnect(device.id)}
                        className={device.connected ? 'button-secondary' : 'button-primary'}
                        disabled={!device.trusted && !device.connected}
                      >
                        {device.connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </div>
                  </div>
                </div>
                
                
                {/* Expandable device details */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => setExpandedDevice(expandedDevice === device.id ? null : device.id)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    {expandedDevice === device.id ? 'Hide Details' : 'Show Details'}
                  </button>
                  
                  {expandedDevice === device.id && (
                    <div className="mt-4 space-y-4">
                      {/* Device Information */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Device Info</h4>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Serial Number:</span>
                              <span>{device.serialNumber || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Device ID:</span>
                              <span className="font-mono text-xs">{device.id.substring(0, 16)}...</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Last Seen:</span>
                              <span>{new Date(device.lastSeen).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Status</h4>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500">Trusted:</span>
                              <span className={device.trusted ? 'text-green-600' : 'text-yellow-600'}>
                                {device.trusted ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500">Paired:</span>
                              <span className={device.paired ? 'text-green-600' : 'text-red-600'}>
                                {device.paired ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Connection:</span>
                              <span className="capitalize">{device.connectionType}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Device Actions */}
                      {device.connected && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Actions</h4>
                          <div className="flex flex-wrap gap-2">
                            <button 
                              onClick={() => handleViewFiles(device.id)}
                              className="px-3 py-1 text-sm button-secondary flex items-center space-x-1"
                            >
                              <FolderOpen size={14} />
                              <span>Browse Files</span>
                            </button>
                            
                            <button 
                              onClick={() => {
                                // In a real implementation, would trigger backup
                                window.unisonx?.log?.info('Starting device backup...');
                              }}
                              className="px-3 py-1 text-sm button-secondary flex items-center space-x-1"
                            >
                              <HardDrive size={14} />
                              <span>Create Backup</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connection Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
          <Settings size={20} />
          <span>Connection Settings</span>
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Auto-connect to trusted devices
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Automatically connect when a trusted iPhone is detected
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Prefer USB over Wi-Fi
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Use USB connection when both USB and Wi-Fi are available
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Show connection notifications
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Display system notifications when devices connect or disconnect
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
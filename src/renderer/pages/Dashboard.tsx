import React, { useEffect, useState } from 'react';
import { 
  Smartphone, 
  MessageSquare, 
  Users, 
  Phone, 
  HardDrive,
  Activity,
  Battery,
  Wifi,
  RefreshCw
} from 'lucide-react';
import { useConnection } from '../context/ConnectionContext';

interface Stats {
  totalMessages: number;
  totalContacts: number;
  totalCalls: number;
  totalFiles: number;
}

export const Dashboard: React.FC = () => {
  const { state, scanForDevices, startSync } = useConnection();
  const [stats, setStats] = useState<Stats>({
    totalMessages: 0,
    totalContacts: 0,
    totalCalls: 0,
    totalFiles: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Load statistics from database with proper error handling
      const [messages, contacts, calls, transfers] = await Promise.all([
        window.unisonx?.db?.query('SELECT COUNT(*) as count FROM messages') || [],
        window.unisonx?.db?.query('SELECT COUNT(*) as count FROM contacts') || [],
        window.unisonx?.db?.query('SELECT COUNT(*) as count FROM call_logs') || [],
        window.unisonx?.db?.query('SELECT COUNT(*) as count FROM file_transfers') || []
      ]);

      setStats({
        totalMessages: messages[0]?.count || 0,
        totalContacts: contacts[0]?.count || 0,
        totalCalls: calls[0]?.count || 0,
        totalFiles: transfers[0]?.count || 0,
      });

      // Load recent activity without using problematic columns
      try {
        await window.unisonx?.db?.query(`
          SELECT 'sync' as type, datetime(created_at) as timestamp,
                 'Device sync completed' as description
          FROM sync_history
          ORDER BY created_at DESC
          LIMIT 10
        `) || [];

        // Recent activity loaded (currently not used in component state)
      } catch (activityError) {
        console.warn('Could not load recent activity:', activityError);
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      window.unisonx?.log?.error('Failed to load dashboard stats', error);
      // Set defaults if query fails
      setStats({
        totalMessages: 0,
        totalContacts: 0,
        totalCalls: 0,
        totalFiles: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await scanForDevices();
    await loadStats();
  };

  const handleSync = async () => {
    if (state.activeDevice?.connected) {
      await startSync();
      await loadStats();
    }
  };

  const formatLastSyncTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const statCards = [
    {
      title: 'Messages',
      value: stats.totalMessages,
      icon: MessageSquare,
      color: 'bg-blue-500',
      loading: loading,
    },
    {
      title: 'Contacts',
      value: stats.totalContacts,
      icon: Users,
      color: 'bg-green-500',
      loading: loading,
    },
    {
      title: 'Call Logs',
      value: stats.totalCalls,
      icon: Phone,
      color: 'bg-purple-500',
      loading: loading,
    },
    {
      title: 'Files Synced',
      value: stats.totalFiles,
      icon: HardDrive,
      color: 'bg-orange-500',
      loading: loading,
    },
  ];

  return (
    <div className="dashboard p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={state.isScanning}
            className="button-secondary flex items-center space-x-2"
          >
            <RefreshCw size={16} className={state.isScanning ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {state.activeDevice?.connected && (
            <button
              onClick={handleSync}
              disabled={state.syncStatus === 'syncing'}
              className="button-primary flex items-center space-x-2"
            >
              <Activity size={16} className={state.syncStatus === 'syncing' ? 'animate-pulse' : ''} />
              <span>
                {state.syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Device Status Card */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Device Status
        </h2>
        
        {state.activeDevice ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Smartphone size={24} className="text-gray-600 dark:text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {state.activeDevice.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {state.activeDevice.model} • iOS {state.activeDevice.osVersion}
                  </div>
                </div>
              </div>
              <div className={`status-indicator ${
                state.activeDevice.connected ? 'status-connected' : 'status-disconnected'
              }`}>
                {state.activeDevice.connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>

            {state.activeDevice.connected && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Battery size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Battery: {state.activeDevice.batteryLevel || 'Unknown'}%
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Wifi size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Connection: {state.activeDevice.connectionType.toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {/* Sync Status */}
            {state.syncStatus !== 'idle' && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sync Status
                  </span>
                  <span className={`status-indicator ${
                    state.syncStatus === 'syncing' ? 'status-syncing' :
                    state.syncStatus === 'success' ? 'status-connected' :
                    'status-disconnected'
                  }`}>
                    {state.syncStatus}
                  </span>
                </div>
                {state.syncStatus === 'syncing' && (
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${state.syncProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-gray-500">
              Last sync: {formatLastSyncTime(state.lastSyncTime)}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Smartphone size={48} className="mx-auto text-gray-400 mb-4" />
            <div className="text-gray-600 dark:text-gray-400 mb-2">
              No device connected
            </div>
            <div className="text-sm text-gray-500">
              Connect your iPhone to get started
            </div>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div key={card.title} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {card.title}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {card.loading ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    card.value.toLocaleString()
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon size={24} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Recent Activity
        </h2>
        <div className="space-y-3">
          {state.lastSyncTime ? (
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">
                Last synchronization completed at {formatLastSyncTime(state.lastSyncTime)}
              </span>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
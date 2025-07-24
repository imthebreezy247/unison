import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Filter,
  RefreshCw,
  Download,
  Plus,
  Search,
  Video,
  VoicemailIcon,
  Clock,
  BarChart3,
  FileText,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { useConnection } from '../context/ConnectionContext';

interface CallLog {
  id: string;
  contact_id?: string;
  phone_number: string;
  contact_name?: string;
  contact_display_name?: string;
  contact_avatar?: string;
  direction: 'incoming' | 'outgoing' | 'missed' | 'blocked' | 'voicemail';
  call_type: 'voice' | 'video' | 'facetime' | 'conference';
  duration: number;
  start_time: string;
  end_time?: string;
  call_status: 'completed' | 'failed' | 'busy' | 'declined' | 'no_answer';
  call_quality: 'excellent' | 'good' | 'fair' | 'poor';
  device_used?: string;
  call_notes?: string;
  voicemail_path?: string;
  voicemail_transcription?: string;
  location_data?: any;
  emergency_call: boolean;
  spam_likely: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface CallStatistics {
  totalCalls: number;
  incomingCalls: number;
  outgoingCalls: number;
  missedCalls: number;
  averageCallDuration: number;
  totalTalkTime: number;
  voicemails: number;
  videoCalls: number;
  mostActiveContact: string;
  busiestDay: string;
  callsByHour: any[];
  callsByDay: any[];
  callsByContact: any[];
}

interface ActiveCall {
  id: string;
  phone_number: string;
  contact_name?: string;
  direction: 'incoming' | 'outgoing';
  call_type: 'voice' | 'video' | 'facetime';
  start_time: string;
  status: 'ringing' | 'connecting' | 'connected' | 'on_hold';
}

export const CallLogs: React.FC = () => {
  const { state } = useConnection();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [statistics, setStatistics] = useState<CallStatistics | null>(null);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState<string>('');
  const [filterCallType, setFilterCallType] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [newCallNumber, setNewCallNumber] = useState('');
  const [callType, setCallType] = useState<'voice' | 'video' | 'facetime'>('voice');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadCallLogs();
    loadStatistics();
    loadActiveCalls();
  }, []);

  useEffect(() => {
    loadCallLogs();
  }, [searchQuery, filterDirection, filterCallType]);

  const loadCallLogs = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      
      if (filterDirection) filters.direction = filterDirection;
      if (filterCallType) filters.call_type = filterCallType;
      
      const logs = await window.unisonx?.calls?.getLogs(100, 0, filters) || [];
      
      // Filter by search query if provided
      let filteredLogs = logs;
      if (searchQuery.trim()) {
        filteredLogs = logs.filter((call: CallLog) => 
          call.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          call.phone_number.includes(searchQuery) ||
          call.call_notes?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      setCallLogs(filteredLogs);
      window.unisonx?.log?.info(`Loaded ${filteredLogs.length} call logs`);
    } catch (error) {
      console.error('Failed to load call logs:', error);
      window.unisonx?.log?.error('Failed to load call logs', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await window.unisonx?.calls?.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load call statistics:', error);
      window.unisonx?.log?.error('Failed to load call statistics', error);
    }
  };

  const loadActiveCalls = async () => {
    try {
      const active = await window.unisonx?.calls?.getActive() || [];
      setActiveCalls(active);
    } catch (error) {
      console.error('Failed to load active calls:', error);
    }
  };

  const handleSyncCalls = async () => {
    if (!state.activeDevice?.connected) {
      alert('No device connected for call sync');
      return;
    }

    try {
      setSyncing(true);
      window.unisonx?.log?.info('Starting call log sync...');
      
      const result = await window.unisonx?.calls?.sync(state.activeDevice.id);
      if (result?.success) {
        await loadCallLogs();
        await loadStatistics();
        window.unisonx?.log?.info(`Call sync completed: ${result.callsImported} calls imported`);
        alert(`Successfully synced ${result.callsImported} call logs!`);
      } else {
        const errorMsg = result?.errors?.join('\n') || 'Unknown error';
        alert(`Call sync failed:\n${errorMsg}`);
      }
    } catch (error) {
      console.error('Call sync failed:', error);
      window.unisonx?.log?.error('Call sync failed', error);
      alert('Call sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleInitiateCall = async () => {
    if (!newCallNumber.trim()) {
      alert('Please enter a phone number');
      return;
    }

    try {
      const callId = await window.unisonx?.calls?.initiate(newCallNumber.trim(), callType);
      window.unisonx?.log?.info(`Call initiated: ${callId}`);
      setShowCallModal(false);
      setNewCallNumber('');
      await loadActiveCalls();
      await loadCallLogs();
      alert('Call initiated successfully!');
    } catch (error) {
      console.error('Failed to initiate call:', error);
      alert('Failed to initiate call');
    }
  };

  const handleEndCall = async (callId: string) => {
    try {
      await window.unisonx?.calls?.end(callId);
      await loadActiveCalls();
      await loadCallLogs();
      alert('Call ended');
    } catch (error) {
      console.error('Failed to end call:', error);
      alert('Failed to end call');
    }
  };

  const handleExportCalls = async (format: 'json' | 'csv' | 'txt') => {
    try {
      setShowExportMenu(false);
      const result = await window.unisonx?.calls?.export(format);
      
      if (result?.success) {
        alert(`Successfully exported ${result.exported} call logs to ${format.toUpperCase()}!`);
        window.unisonx?.log?.info(`Call logs exported: ${result.exported} to ${result.filePath}`);
      } else {
        alert(`Export failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to export call logs:', error);
      alert('Failed to export call logs');
    }
  };

  const handleSaveNotes = async (callId: string) => {
    try {
      await window.unisonx?.calls?.addNotes(callId, noteText);
      setEditingNotes(null);
      setNoteText('');
      await loadCallLogs();
      alert('Notes saved successfully!');
    } catch (error) {
      console.error('Failed to save notes:', error);
      alert('Failed to save notes');
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const callDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (callDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (callDate.getTime() === today.getTime() - 86400000) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getCallIcon = (call: CallLog) => {
    if (call.direction === 'missed') {
      return <PhoneMissed size={16} className="text-red-500" />;
    } else if (call.direction === 'incoming') {
      return <PhoneIncoming size={16} className="text-green-500" />;
    } else if (call.direction === 'outgoing') {
      return <PhoneOutgoing size={16} className="text-blue-500" />;
    } else if (call.direction === 'voicemail') {
      return <VoicemailIcon size={16} className="text-purple-500" />;
    } else {
      return <PhoneCall size={16} className="text-gray-500" />;
    }
  };

  const getCallTypeIcon = (callType: string) => {
    switch (callType) {
      case 'video':
      case 'facetime':
        return <Video size={14} className="text-blue-500" />;
      default:
        return <Phone size={14} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
      case 'busy':
      case 'declined':
        return 'text-red-600';
      case 'no_answer':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="call-logs h-full flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="loading-spinner w-8 h-8"></div>
          <span className="text-gray-600 dark:text-gray-400">Loading call logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="call-logs h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Call Logs
          </h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowStatistics(!showStatistics)}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
              title="Show statistics"
            >
              <BarChart3 size={18} />
            </button>
            <button
              onClick={handleSyncCalls}
              disabled={!state.activeDevice?.connected || syncing}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
              title="Sync call logs"
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowCallModal(true)}
              className="button-primary flex items-center space-x-2"
            >
              <Plus size={16} />
              <span>New Call</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search calls by contact, number, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`button-secondary flex items-center space-x-2 ${showFilters ? 'bg-blue-100 text-blue-700' : ''}`}
          >
            <Filter size={16} />
            <span>Filters</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="button-secondary flex items-center space-x-2"
            >
              <Download size={16} />
              <span>Export</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="py-1">
                  <button
                    onClick={() => handleExportCalls('csv')}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FileText size={16} />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    onClick={() => handleExportCalls('json')}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FileText size={16} />
                    <span>Export as JSON</span>
                  </button>
                  <button
                    onClick={() => handleExportCalls('txt')}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FileText size={16} />
                    <span>Export as TXT</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Direction
                </label>
                <select
                  value={filterDirection}
                  onChange={(e) => setFilterDirection(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Directions</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                  <option value="missed">Missed</option>
                  <option value="voicemail">Voicemail</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Call Type
                </label>
                <select
                  value={filterCallType}
                  onChange={(e) => setFilterCallType(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Types</option>
                  <option value="voice">Voice</option>
                  <option value="video">Video</option>
                  <option value="facetime">FaceTime</option>
                  <option value="conference">Conference</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterDirection('');
                    setFilterCallType('');
                  }}
                  className="button-secondary w-full"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Statistics Panel */}
      {showStatistics && statistics && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{statistics.totalCalls}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Calls</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{statistics.incomingCalls}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Incoming</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{statistics.outgoingCalls}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Outgoing</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{statistics.missedCalls}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Missed</div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatDuration(statistics.averageCallDuration)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Average Duration</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {statistics.mostActiveContact}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Most Active Contact</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {statistics.busiestDay}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Busiest Day</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Calls */}
      {activeCalls.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-blue-900 dark:text-blue-100">Active Calls</h3>
          </div>
          <div className="space-y-2">
            {activeCalls.map((call) => (
              <div key={call.id} className="flex items-center justify-between bg-blue-100 dark:bg-blue-800 p-3 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <div className="font-medium text-blue-900 dark:text-blue-100">
                      {call.contact_name || call.phone_number}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      {call.status} • {call.call_type}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleEndCall(call.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  End Call
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call Logs List */}
      <div className="flex-1 overflow-y-auto">
        {callLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Phone size={48} className="text-gray-400 mb-4" />
            <div className="text-gray-600 dark:text-gray-400 mb-2">
              No call logs found
            </div>
            <div className="text-sm text-gray-500">
              {state.activeDevice?.connected ? 'Sync your iPhone to load call logs' : 'Connect your iPhone to sync call logs'}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {callLogs.map((call) => (
              <div
                key={call.id}
                className="bg-white dark:bg-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => setSelectedCall(call)}
              >
                <div className="flex items-start space-x-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white font-medium flex-shrink-0">
                    {call.contact_avatar ? (
                      <img
                        src={call.contact_avatar}
                        alt={call.contact_name || call.phone_number}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <span>
                        {(call.contact_name || call.phone_number).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Call Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {call.contact_display_name || call.contact_name || call.phone_number}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {getCallIcon(call)}
                        {getCallTypeIcon(call.call_type)}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>{formatTime(call.start_time)}</span>
                        {call.duration > 0 && (
                          <span className="flex items-center space-x-1">
                            <Clock size={12} />
                            <span>{formatDuration(call.duration)}</span>
                          </span>
                        )}
                        <span className={`capitalize ${getStatusColor(call.call_status)}`}>
                          {call.call_status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {call.emergency_call && (
                          <AlertTriangle size={14} className="text-red-500" />
                        )}
                        {call.spam_likely && (
                          <AlertTriangle size={14} className="text-orange-500" />
                        )}
                        {call.voicemail_path && (
                          <VoicemailIcon size={14} className="text-purple-500" />
                        )}
                        {call.call_notes && (
                          <MessageSquare size={14} className="text-blue-500" />
                        )}
                      </div>
                    </div>

                    {/* Call Notes Preview */}
                    {call.call_notes && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 truncate">
                        Notes: {call.call_notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Call Modal */}
      {showCallModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Initiate Call
              </h3>
              <button
                onClick={() => setShowCallModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newCallNumber}
                  onChange={(e) => setNewCallNumber(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Call Type
                </label>
                <select
                  value={callType}
                  onChange={(e) => setCallType(e.target.value as 'voice' | 'video' | 'facetime')}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="voice">Voice Call</option>
                  <option value="video">Video Call</option>
                  <option value="facetime">FaceTime</option>
                </select>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCallModal(false)}
                  className="flex-1 button-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitiateCall}
                  className="flex-1 button-primary"
                >
                  Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Detail Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Call Details
              </h3>
              <button
                onClick={() => setSelectedCall(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Contact Info */}
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white font-medium">
                  {selectedCall.contact_avatar ? (
                    <img
                      src={selectedCall.contact_avatar}
                      alt={selectedCall.contact_name || selectedCall.phone_number}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">
                      {(selectedCall.contact_name || selectedCall.phone_number).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {selectedCall.contact_display_name || selectedCall.contact_name || 'Unknown'}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">{selectedCall.phone_number}</p>
                </div>
              </div>

              {/* Call Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Direction</label>
                  <div className="flex items-center space-x-2 mt-1">
                    {getCallIcon(selectedCall)}
                    <span className="capitalize text-gray-900 dark:text-gray-100">
                      {selectedCall.direction}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                  <div className="flex items-center space-x-2 mt-1">
                    {getCallTypeIcon(selectedCall.call_type)}
                    <span className="capitalize text-gray-900 dark:text-gray-100">
                      {selectedCall.call_type}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duration</label>
                  <p className="text-gray-900 dark:text-gray-100 mt-1">
                    {formatDuration(selectedCall.duration)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <p className={`capitalize mt-1 ${getStatusColor(selectedCall.call_status)}`}>
                    {selectedCall.call_status.replace('_', ' ')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Time</label>
                  <p className="text-gray-900 dark:text-gray-100 mt-1">
                    {new Date(selectedCall.start_time).toLocaleString()}
                  </p>
                </div>

                {selectedCall.end_time && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Time</label>
                    <p className="text-gray-900 dark:text-gray-100 mt-1">
                      {new Date(selectedCall.end_time).toLocaleString()}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quality</label>
                  <p className="capitalize text-gray-900 dark:text-gray-100 mt-1">
                    {selectedCall.call_quality}
                  </p>
                </div>

                {selectedCall.device_used && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Device</label>
                    <p className="text-gray-900 dark:text-gray-100 mt-1">
                      {selectedCall.device_used}
                    </p>
                  </div>
                )}
              </div>

              {/* Call Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Call Notes
                  </label>
                  {editingNotes !== selectedCall.id && (
                    <button
                      onClick={() => {
                        setEditingNotes(selectedCall.id);
                        setNoteText(selectedCall.call_notes || '');
                      }}
                      className="text-blue-500 hover:text-blue-600 text-sm"
                    >
                      {selectedCall.call_notes ? 'Edit' : 'Add Notes'}
                    </button>
                  )}
                </div>

                {editingNotes === selectedCall.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add call notes..."
                      rows={3}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSaveNotes(selectedCall.id)}
                        className="button-primary text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingNotes(null);
                          setNoteText('');
                        }}
                        className="button-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                    {selectedCall.call_notes || 'No notes for this call'}
                  </p>
                )}
              </div>

              {/* Voicemail Transcription */}
              {selectedCall.voicemail_transcription && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Voicemail Transcription
                  </label>
                  <p className="text-gray-900 dark:text-gray-100 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-md">
                    {selectedCall.voicemail_transcription}
                  </p>
                </div>
              )}

              {/* Warning Indicators */}
              {(selectedCall.emergency_call || selectedCall.spam_likely) && (
                <div className="flex items-center space-x-4">
                  {selectedCall.emergency_call && (
                    <div className="flex items-center space-x-2 text-red-600">
                      <AlertTriangle size={16} />
                      <span className="text-sm font-medium">Emergency Call</span>
                    </div>
                  )}
                  {selectedCall.spam_likely && (
                    <div className="flex items-center space-x-2 text-orange-600">
                      <AlertTriangle size={16} />
                      <span className="text-sm font-medium">Likely Spam</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Plus,
  RefreshCw,
  Archive,
  Settings,
  Phone,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  Download,
  FileText,
  BarChart3
} from 'lucide-react';
import { useConnection } from '../context/ConnectionContext';

interface MessageThread {
  id: string;
  contact_id?: string;
  phone_number?: string;
  contact_name?: string;
  contact_avatar?: string;
  last_message_content?: string;
  last_message_type?: 'sms' | 'imessage' | 'rcs';
  last_message_timestamp?: string;
  unread_count: number;
  is_group: boolean;
  group_name?: string;
  archived: boolean;
  pinned: boolean;
  muted: boolean;
}

interface Message {
  id: string;
  thread_id: string;
  contact_id?: string;
  phone_number?: string;
  contact_name?: string;
  contact_avatar?: string;
  content: string;
  message_type: 'sms' | 'imessage' | 'rcs';
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  read_status: boolean;
  delivered_status: boolean;
  failed_status: boolean;
  attachments?: any[];
}

export const Messages: React.FC = () => {
  const { state } = useConnection();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (selectedThread) {
      loadThreadMessages(selectedThread.id);
    }
  }, [selectedThread]);

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch();
    } else {
      setShowSearchResults(false);
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadThreads = async () => {
    try {
      setLoading(true);
      const threadsData = await window.unisonx?.messages?.getThreads(50, 0) || [];
      setThreads(threadsData);
      
      // Auto-select first thread if none selected
      if (threadsData.length > 0 && !selectedThread) {
        setSelectedThread(threadsData[0]);
      }
      
      window.unisonx?.log?.info(`Loaded ${threadsData.length} message threads`);
    } catch (error) {
      console.error('Failed to load message threads:', error);
      window.unisonx?.log?.error('Failed to load message threads', error);
    } finally {
      setLoading(false);
    }
  };

  const loadThreadMessages = async (threadId: string) => {
    try {
      const messagesData = await window.unisonx?.messages?.getThreadMessages(threadId, 100, 0) || [];
      setMessages(messagesData);
      
      // Mark thread as read
      await window.unisonx?.messages?.markAsRead(threadId);
      
      window.unisonx?.log?.info(`Loaded ${messagesData.length} messages for thread ${threadId}`);
    } catch (error) {
      console.error('Failed to load thread messages:', error);
      window.unisonx?.log?.error('Failed to load thread messages', error);
    }
  };

  const handleSyncMessages = async () => {
    if (!state.activeDevice?.connected) {
      window.unisonx?.log?.error('No device connected for message sync');
      return;
    }

    try {
      setSyncing(true);
      window.unisonx?.log?.info('Starting message sync...');
      
      const result = await window.unisonx?.messages?.sync(state.activeDevice.id);
      if (result?.success) {
        await loadThreads();
        window.unisonx?.log?.info(`Message sync completed: ${result.messagesImported} messages`);
        alert(`Successfully synced ${result.messagesImported} messages!`);
      } else {
        const errorMsg = result?.errors?.join('\n') || 'Unknown error';
        alert(`Message sync failed:\n${errorMsg}`);
      }
    } catch (error) {
      console.error('Message sync failed:', error);
      window.unisonx?.log?.error('Message sync failed', error);
      alert('Message sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleImportBackup = async () => {
    try {
      setLoading(true);
      window.unisonx?.log?.info('Starting iTunes backup import...');
      
      const result = await window.unisonx?.messages?.importBackup();
      if (result?.success) {
        await loadThreads();
        window.unisonx?.log?.info(`Backup import completed: ${result.messagesImported} messages`);
        alert(`Successfully imported ${result.messagesImported} messages from iTunes backup!\n\nThreads created: ${result.threadsCreated}`);
      } else {
        const errorMsg = result?.errors?.join('\n') || 'Unknown error';
        alert(`Backup import failed:\n${errorMsg}\n\nMake sure you have created an unencrypted iTunes backup.`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      window.unisonx?.log?.error('Backup import failed', error);
      alert('Failed to import messages from backup.\n\nPlease ensure:\n1. iTunes backup exists\n2. Backup is NOT encrypted\n3. Backup contains message data');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThread || !newMessage.trim() || sending) {
      return;
    }

    try {
      setSending(true);
      const messageId = await window.unisonx?.messages?.send(
        selectedThread.id,
        newMessage.trim(),
        'imessage' // Default to iMessage
      );
      
      setNewMessage('');
      await loadThreadMessages(selectedThread.id);
      window.unisonx?.log?.info(`Message sent: ${messageId}`);
    } catch (error) {
      console.error('Failed to send message:', error);
      window.unisonx?.log?.error('Failed to send message', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await window.unisonx?.messages?.search(searchQuery.trim(), 50) || [];
      setSearchResults(results);
      setShowSearchResults(true);
      window.unisonx?.log?.info(`Search completed: ${results.length} results for "${searchQuery}"`);
    } catch (error) {
      console.error('Failed to search messages:', error);
      window.unisonx?.log?.error('Failed to search messages', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = (message: Message) => {
    // Find and select the thread containing this message
    const thread = threads.find(t => t.id === message.thread_id);
    if (thread) {
      setSelectedThread(thread);
      setShowSearchResults(false);
      setSearchQuery('');
    }
  };

  const handleExportMessages = async (format: 'json' | 'csv' | 'txt') => {
    try {
      setShowExportMenu(false);
      const threadId = selectedThread?.id;
      const result = await window.unisonx?.messages?.export(threadId, format);
      
      if (result?.success) {
        alert(`Successfully exported ${result.exported} messages to ${format.toUpperCase()}!`);
        window.unisonx?.log?.info(`Messages exported: ${result.exported} to ${result.filePath}`);
      } else {
        alert(`Export failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to export messages:', error);
      alert('Failed to export messages');
    }
  };

  const handleNewMessage = () => {
    // For now, create a new thread with a phone number
    const phoneNumber = prompt('Enter phone number to message:');
    if (!phoneNumber) return;
    
    const newThread: MessageThread = {
      id: `thread-new-${Date.now()}`,
      phone_number: phoneNumber,
      contact_name: phoneNumber,
      last_message_content: '',
      last_message_timestamp: new Date().toISOString(),
      unread_count: 0,
      is_group: false,
      archived: false,
      pinned: false,
      muted: false
    };
    
    setThreads([newThread, ...threads]);
    setSelectedThread(newThread);
  };

  const handleArchiveThread = async () => {
    if (!selectedThread) return;
    
    try {
      await window.unisonx?.messages?.archiveThread(selectedThread.id, true);
      alert('Conversation archived successfully!');
      await loadThreads();
      setSelectedThread(null);
    } catch (error) {
      console.error('Failed to archive thread:', error);
      alert('Failed to archive conversation');
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (messageDate.getTime() === today.getTime() - 86400000) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const getContactDisplayName = (thread: MessageThread) => {
    if (thread.is_group && thread.group_name) {
      return thread.group_name;
    }
    return thread.contact_name || thread.phone_number || 'Unknown';
  };

  const getMessageTypeColor = (messageType: string) => {
    switch (messageType) {
      case 'imessage':
        return 'text-blue-600';
      case 'sms':
        return 'text-green-600';
      case 'rcs':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="messages h-full flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="loading-spinner w-8 h-8"></div>
          <span className="text-gray-600 dark:text-gray-400">Loading messages...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="messages h-full flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Thread List */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Messages
            </h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSyncMessages}
                disabled={!state.activeDevice?.connected || syncing}
                className="p-2 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                title="Sync messages"
              >
                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={handleImportBackup}
                className="p-2 text-gray-500 hover:text-green-600 transition-colors"
                title="Import from iTunes backup"
              >
                <Download size={18} />
              </button>
              <button 
                onClick={handleNewMessage}
                className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                title="New message"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="loading-spinner w-4 h-4"></div>
              </div>
            )}
          </div>
        </div>

        {/* Thread List or Search Results */}
        <div className="flex-1 overflow-y-auto">
          {showSearchResults ? (
            /* Search Results */
            <div className="p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {searchResults.length} results for "{searchQuery}"
              </div>
              {searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <Search size={32} className="mx-auto text-gray-400 mb-2" />
                  <div className="text-gray-600 dark:text-gray-400">
                    No messages found
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((message) => (
                    <div
                      key={message.id}
                      onClick={() => handleSearchResultClick(message)}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                              {message.contact_name || message.phone_number || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTime(message.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {message.content}
                          </p>
                        </div>
                        <span className={`text-xs font-medium ml-2 ${getMessageTypeColor(message.message_type)}`}>
                          {message.message_type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <MessageSquare size={48} className="text-gray-400 mb-4" />
              <div className="text-gray-600 dark:text-gray-400 mb-2">
                No conversations yet
              </div>
              <div className="text-sm text-gray-500">
                Sync your iPhone to load messages
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => setSelectedThread(thread)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedThread?.id === thread.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white font-medium flex-shrink-0">
                      {thread.contact_avatar ? (
                        <img
                          src={thread.contact_avatar}
                          alt={getContactDisplayName(thread)}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span>
                          {getContactDisplayName(thread).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {getContactDisplayName(thread)}
                        </h3>
                        <div className="flex items-center space-x-1">
                          {thread.last_message_timestamp && (
                            <span className="text-xs text-gray-500">
                              {formatTime(thread.last_message_timestamp)}
                            </span>
                          )}
                          {thread.unread_count > 0 && (
                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-500 rounded-full">
                              {thread.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {thread.last_message_content || 'No messages'}
                        </p>
                        {thread.last_message_type && (
                          <span className={`text-xs font-medium ${getMessageTypeColor(thread.last_message_type)}`}>
                            {thread.last_message_type.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Conversation View */}
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            {/* Conversation Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white font-medium">
                    {selectedThread.contact_avatar ? (
                      <img
                        src={selectedThread.contact_avatar}
                        alt={getContactDisplayName(selectedThread)}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span>
                        {getContactDisplayName(selectedThread).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {getContactDisplayName(selectedThread)}
                    </h3>
                    {selectedThread.phone_number && (
                      <p className="text-sm text-gray-500">
                        {selectedThread.phone_number}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                    <Phone size={18} />
                  </button>
                  
                  {/* Export Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                      title="Export conversation"
                    >
                      <Download size={18} />
                    </button>
                    
                    {showExportMenu && (
                      <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                        <div className="py-1">
                          <button
                            onClick={() => handleExportMessages('txt')}
                            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FileText size={16} />
                            <span>Export as TXT</span>
                          </button>
                          <button
                            onClick={() => handleExportMessages('csv')}
                            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <BarChart3 size={16} />
                            <span>Export as CSV</span>
                          </button>
                          <button
                            onClick={() => handleExportMessages('json')}
                            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FileText size={16} />
                            <span>Export as JSON</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={handleArchiveThread}
                    className="p-2 text-gray-500 hover:text-orange-600 transition-colors"
                    title="Archive conversation"
                  >
                    <Archive size={18} />
                  </button>
                  
                  <button className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.direction === 'outgoing'
                        ? message.message_type === 'imessage'
                          ? 'bg-blue-500 text-white'
                          : 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs opacity-75">
                        {formatTime(message.timestamp)}
                      </span>
                      {message.direction === 'outgoing' && (
                        <span className="text-xs opacity-75">
                          {message.delivered_status ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                  <Paperclip size={18} />
                </button>
                
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <button className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                  <Smile size={18} />
                </button>
                
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* No conversation selected */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={64} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Choose a conversation from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
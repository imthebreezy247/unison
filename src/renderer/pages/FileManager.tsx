import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  Upload,
  Download,
  File,
  Image,
  Video,
  Music,
  FileText,
  Archive,
  Smartphone,
  HardDrive,
  RefreshCw,
  Search,
  Filter,
  Grid,
  List,
  Play,
  Pause,
  X,
  Plus,
  Trash2,
  Star,
  Share,
  Copy,
  Move,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader
} from 'lucide-react';
import { useConnection } from '../context/ConnectionContext';

interface FileTransfer {
  id: string;
  device_id?: string;
  filename: string;
  source_path: string;
  destination_path: string;
  file_size: number;
  file_type?: string;
  mime_type?: string;
  file_extension?: string;
  transfer_type: 'import' | 'export' | 'sync';
  transfer_method: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: number;
  transfer_speed: number;
  bytes_transferred: number;
  error_message?: string;
  thumbnail_path?: string;
  folder_path?: string;
  favorite: boolean;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface FileFolder {
  id: string;
  name: string;
  parent_folder_id?: string;
  folder_type: string;
  color: string;
  icon: string;
  description?: string;
  fileCount?: number;
}

interface TransferProgress {
  id: string;
  filename: string;
  progress: number;
  status: string;
  transferSpeed: number;
  bytesTransferred: number;
  estimatedTimeRemaining: number;
}

interface TransferStatistics {
  totalTransfers: number;
  completedTransfers: number;
  failedTransfers: number;
  totalBytesTransferred: number;
  averageTransferSpeed: number;
  transfersByType: any[];
  transfersByDate: any[];
  recentTransfers: FileTransfer[];
}

export const FileManager: React.FC = () => {
  const { state } = useConnection();
  const [files, setFiles] = useState<FileTransfer[]>([]);
  const [folders, setFolders] = useState<FileFolder[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<TransferProgress[]>([]);
  const [statistics, setStatistics] = useState<TransferStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
    loadFolders();
    loadActiveTransfers();
    loadStatistics();

    // Poll for active transfer updates
    const interval = setInterval(() => {
      loadActiveTransfers();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadFiles();
  }, [selectedFolder, searchQuery, filterType, filterStatus]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      
      if (filterType) filters.file_type = filterType;
      if (filterStatus) filters.status = filterStatus;
      
      const transfers = await window.unisonx?.files?.getTransfers(100, 0, filters) || [];
      
      let filteredFiles = transfers;
      if (searchQuery.trim()) {
        filteredFiles = transfers.filter((file: FileTransfer) => 
          file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.file_type?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      setFiles(filteredFiles);
      window.unisonx?.log?.info(`Loaded ${filteredFiles.length} files`);
    } catch (error) {
      console.error('Failed to load files:', error);
      window.unisonx?.log?.error('Failed to load files', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const folderList = await window.unisonx?.files?.getFolders() || [];
      setFolders(folderList);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const loadActiveTransfers = async () => {
    try {
      const active = await window.unisonx?.files?.getActiveTransfers() || [];
      setActiveTransfers(active);
    } catch (error) {
      console.error('Failed to load active transfers:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await window.unisonx?.files?.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach(async (file) => {
      try {
        const transferRequest = {
          filename: file.name,
          sourcePath: file.path || '',
          destinationPath: `./downloads/${file.name}`,
          transferType: 'import' as const,
          deviceId: state.activeDevice?.id,
          folderId: selectedFolder || undefined
        };

        const transferId = await window.unisonx?.files?.startTransfer(transferRequest);
        window.unisonx?.log?.info(`Started transfer: ${transferId}`);
        
        await loadFiles();
        await loadActiveTransfers();
      } catch (error) {
        console.error(`Failed to start transfer for ${file.name}:`, error);
        alert(`Failed to transfer ${file.name}`);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handlePauseTransfer = async (transferId: string) => {
    try {
      await window.unisonx?.files?.pauseTransfer(transferId);
      await loadActiveTransfers();
      await loadFiles();
    } catch (error) {
      console.error('Failed to pause transfer:', error);
      alert('Failed to pause transfer');
    }
  };

  const handleResumeTransfer = async (transferId: string) => {
    try {
      await window.unisonx?.files?.resumeTransfer(transferId);
      await loadActiveTransfers();
      await loadFiles();
    } catch (error) {
      console.error('Failed to resume transfer:', error);
      alert('Failed to resume transfer');
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    try {
      await window.unisonx?.files?.cancelTransfer(transferId);
      await loadActiveTransfers();
      await loadFiles();
    } catch (error) {
      console.error('Failed to cancel transfer:', error);
      alert('Failed to cancel transfer');
    }
  };

  const handleExportFiles = async (format: 'json' | 'csv' | 'txt') => {
    try {
      const result = await window.unisonx?.files?.export(format);
      
      if (result?.success) {
        alert(`Successfully exported ${result.exported} files to ${format.toUpperCase()}!`);
        window.unisonx?.log?.info(`Files exported: ${result.exported} to ${result.filePath}`);
      } else {
        alert(`Export failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to export files:', error);
      alert('Failed to export files');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const folderData = {
        name: newFolderName,
        folder_type: 'custom',
        color: newFolderColor,
        icon: 'folder',
        auto_organize: false
      };

      await window.unisonx?.files?.createFolder(folderData);
      setShowFolderModal(false);
      setNewFolderName('');
      setNewFolderColor('#3B82F6');
      await loadFolders();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder');
    }
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const getFileIcon = (file: FileTransfer) => {
    switch (file.file_type) {
      case 'image':
        return <Image size={20} className="text-green-500" />;
      case 'video':
        return <Video size={20} className="text-purple-500" />;
      case 'audio':
        return <Music size={20} className="text-blue-500" />;
      case 'document':
        return <FileText size={20} className="text-orange-500" />;
      default:
        return <File size={20} className="text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      case 'in_progress':
        return <Loader size={16} className="text-blue-500 animate-spin" />;
      case 'paused':
        return <Pause size={16} className="text-yellow-500" />;
      case 'cancelled':
        return <X size={16} className="text-gray-500" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTransferSpeed = (bytesPerSecond: number): string => {
    return formatFileSize(bytesPerSecond) + '/s';
  };

  const formatTime = (seconds: number): string => {
    if (seconds === Infinity || isNaN(seconds)) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (loading) {
    return (
      <div className="file-manager h-full flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="loading-spinner w-8 h-8"></div>
          <span className="text-gray-600 dark:text-gray-400">Loading files...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="file-manager h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            File Manager
          </h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowStatistics(!showStatistics)}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <BarChart3 size={18} />
            </button>
            <button
              onClick={loadFiles}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => setShowFolderModal(true)}
              className="button-secondary flex items-center space-x-2"
            >
              <Plus size={16} />
              <span>New Folder</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="button-primary flex items-center space-x-2"
            >
              <Upload size={16} />
              <span>Upload Files</span>
            </button>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
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

          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  File Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Types</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="audio">Audio</option>
                  <option value="document">Documents</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterType('');
                    setFilterStatus('');
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
              <div className="text-2xl font-bold text-blue-600">{statistics.totalTransfers}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Files</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{statistics.completedTransfers}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{statistics.failedTransfers}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{formatFileSize(statistics.totalBytesTransferred)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Size</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Transfers */}
      {activeTransfers.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-blue-900 dark:text-blue-100">Active Transfers</h3>
          </div>
          <div className="space-y-2">
            {activeTransfers.map((transfer) => (
              <div key={transfer.id} className="bg-blue-100 dark:bg-blue-800 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-blue-900 dark:text-blue-100 truncate">
                    {transfer.filename}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePauseTransfer(transfer.id)}
                      className="p-1 text-blue-700 hover:text-blue-900"
                    >
                      <Pause size={16} />
                    </button>
                    <button
                      onClick={() => handleCancelTransfer(transfer.id)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${transfer.progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-blue-700 dark:text-blue-300">
                  <span>{transfer.progress}%</span>
                  <span>{formatTransferSpeed(transfer.transferSpeed)}</span>
                  <span>ETA: {formatTime(transfer.estimatedTimeRemaining)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Folders</h3>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedFolder('')}
              className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                selectedFolder === '' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : ''
              }`}
            >
              <FolderOpen size={20} className="text-gray-500" />
              <span>All Files</span>
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  selectedFolder === folder.id ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : ''
                }`}
              >
                <div
                  className="w-5 h-5 rounded"
                  style={{ backgroundColor: folder.color }}
                ></div>
                <span>{folder.name}</span>
                {folder.fileCount && (
                  <span className="text-xs text-gray-500 ml-auto">{folder.fileCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {/* Drop Zone */}
          <div
            className={`h-full ${dragOver ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-400' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <FolderOpen size={48} className="text-gray-400 mb-4" />
                <div className="text-gray-600 dark:text-gray-400 mb-2">
                  {dragOver ? 'Drop files here to upload' : 'No files found'}
                </div>
                <div className="text-sm text-gray-500">
                  Drag and drop files here or click "Upload Files" to get started
                </div>
              </div>
            ) : (
              <div className="p-6 h-full overflow-y-auto">
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={`bg-white dark:bg-gray-800 rounded-lg border-2 p-4 cursor-pointer hover:shadow-md transition-all ${
                          selectedFiles.has(file.id) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
                        }`}
                        onClick={() => toggleFileSelection(file.id)}
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className="mb-3">
                            {file.thumbnail_path ? (
                              <img
                                src={file.thumbnail_path}
                                alt={file.filename}
                                className="w-16 h-16 object-cover rounded"
                              />
                            ) : (
                              getFileIcon(file)
                            )}
                          </div>
                          <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate w-full mb-1">
                            {file.filename}
                          </h3>
                          <div className="flex items-center space-x-2 mb-2">
                            {getStatusIcon(file.status)}
                            <span className="text-xs text-gray-500">{formatFileSize(file.file_size)}</span>
                          </div>
                          {file.favorite && (
                            <Star size={16} className="text-yellow-500 mb-1" />
                          )}
                          <div className="text-xs text-gray-500">
                            {new Date(file.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={`bg-white dark:bg-gray-800 rounded-lg border p-4 cursor-pointer hover:shadow-md transition-all ${
                          selectedFiles.has(file.id) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
                        }`}
                        onClick={() => toggleFileSelection(file.id)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            {getFileIcon(file)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {file.filename}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                              <span>{formatFileSize(file.file_size)}</span>
                              <span>{file.file_type}</span>
                              <span>{new Date(file.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {file.favorite && <Star size={16} className="text-yellow-500" />}
                            {getStatusIcon(file.status)}
                            {file.progress < 100 && file.status === 'in_progress' && (
                              <span className="text-sm text-blue-600">{file.progress}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File Upload Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* New Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Create New Folder
              </h3>
              <button
                onClick={() => setShowFolderModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <div className="flex space-x-2">
                  {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewFolderColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newFolderColor === color ? 'border-gray-900 dark:border-gray-100' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowFolderModal(false)}
                  className="flex-1 button-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="flex-1 button-primary"
                  disabled={!newFolderName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
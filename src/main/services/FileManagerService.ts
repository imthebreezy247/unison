import { DatabaseManager, FileTransfer, FileFolder, FileShare } from '../database/DatabaseManager';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import log from 'electron-log';
import { app } from 'electron';

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
  transfersByType: any;
  transfersByDate: any;
  recentTransfers: FileTransfer[];
}

interface DeviceStorage {
  path: string;
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  folders: DeviceFolder[];
}

interface DeviceFolder {
  name: string;
  path: string;
  type: 'photos' | 'videos' | 'documents' | 'apps' | 'music' | 'other';
  fileCount: number;
  size: number;
  lastModified: string;
}

export class FileManagerService {
  private databaseManager: DatabaseManager;
  private activeTransfers: Map<string, TransferProgress> = new Map();
  private transferQueue: FileTransfer[] = [];
  private isProcessing = false;
  private maxConcurrentTransfers = 3;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  async initialize(): Promise<void> {
    try {
      log.info('Initializing FileManagerService...');
      
      // Create default folders
      await this.createDefaultFolders();
      
      // Resume any incomplete transfers
      await this.resumeIncompleteTransfers();
      
      log.info('FileManagerService initialized successfully');
    } catch (error) {
      log.error('Failed to initialize FileManagerService:', error);
      throw error;
    }
  }

  private async createDefaultFolders(): Promise<void> {
    const defaultFolders = [
      { id: 'photos', name: 'Photos', folder_type: 'photos', color: '#10B981', icon: 'image' },
      { id: 'videos', name: 'Videos', folder_type: 'videos', color: '#8B5CF6', icon: 'video' },
      { id: 'documents', name: 'Documents', folder_type: 'documents', color: '#F59E0B', icon: 'file-text' },
      { id: 'downloads', name: 'Downloads', folder_type: 'downloads', color: '#3B82F6', icon: 'download' },
      { id: 'trash', name: 'Trash', folder_type: 'trash', color: '#EF4444', icon: 'trash-2' }
    ];

    for (const folder of defaultFolders) {
      try {
        await this.databaseManager.run(
          'INSERT OR IGNORE INTO file_folders (id, name, folder_type, color, icon, auto_organize) VALUES (?, ?, ?, ?, ?, ?)',
          [folder.id, folder.name, folder.folder_type, folder.color, folder.icon, true]
        );
      } catch (error) {
        log.warn(`Failed to create default folder ${folder.name}:`, error);
      }
    }
  }

  private async resumeIncompleteTransfers(): Promise<void> {
    try {
      const incompleteTransfers = await this.databaseManager.query(
        'SELECT * FROM file_transfers WHERE status IN (?, ?, ?) ORDER BY created_at DESC',
        ['pending', 'in_progress', 'paused']
      );

      for (const transfer of incompleteTransfers) {
        if (transfer.status === 'in_progress') {
          // Reset in-progress transfers to pending
          await this.databaseManager.run(
            'UPDATE file_transfers SET status = ? WHERE id = ?',
            ['pending', transfer.id]
          );
        }
        
        this.transferQueue.push(transfer);
      }

      if (this.transferQueue.length > 0) {
        log.info(`Resumed ${this.transferQueue.length} incomplete transfers`);
        this.processTransferQueue();
      }
    } catch (error) {
      log.error('Failed to resume incomplete transfers:', error);
    }
  }

  async startTransfer(transferRequest: {
    filename: string;
    sourcePath: string;
    destinationPath: string;
    transferType: 'import' | 'export' | 'sync';
    deviceId?: string;
    folderId?: string;
    autoDeleteSource?: boolean;
  }): Promise<string> {
    try {
      const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Get file information
      const stats = await fs.promises.stat(transferRequest.sourcePath);
      const fileExtension = path.extname(transferRequest.filename).toLowerCase();
      const mimeType = this.getMimeType(fileExtension);
      const fileType = this.getFileType(mimeType);

      // Calculate checksum for integrity verification
      const checksum = await this.calculateChecksum(transferRequest.sourcePath);

      const transfer: Omit<FileTransfer, 'created_at' | 'updated_at'> = {
        id: transferId,
        device_id: transferRequest.deviceId,
        filename: transferRequest.filename,
        source_path: transferRequest.sourcePath,
        destination_path: transferRequest.destinationPath,
        file_size: stats.size,
        file_type: fileType,
        mime_type: mimeType,
        file_extension: fileExtension,
        transfer_type: transferRequest.transferType,
        transfer_method: 'usb',
        status: 'pending',
        progress: 0,
        transfer_speed: 0,
        bytes_transferred: 0,
        checksum: checksum,
        original_created_date: stats.birthtime.toISOString(),
        original_modified_date: stats.mtime.toISOString(),
        favorite: false,
        auto_delete_source: transferRequest.autoDeleteSource || false
      };

      // Insert transfer record
      await this.databaseManager.run(`
        INSERT INTO file_transfers (
          id, device_id, filename, source_path, destination_path, file_size,
          file_type, mime_type, file_extension, transfer_type, transfer_method,
          status, progress, transfer_speed, bytes_transferred, checksum,
          original_created_date, original_modified_date, favorite, auto_delete_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transfer.id, transfer.device_id, transfer.filename, transfer.source_path,
        transfer.destination_path, transfer.file_size, transfer.file_type,
        transfer.mime_type, transfer.file_extension, transfer.transfer_type,
        transfer.transfer_method, transfer.status, transfer.progress,
        transfer.transfer_speed, transfer.bytes_transferred, transfer.checksum,
        transfer.original_created_date, transfer.original_modified_date,
        transfer.favorite, transfer.auto_delete_source
      ]);

      // Add to folder if specified
      if (transferRequest.folderId) {
        await this.addFileToFolder(transferId, transferRequest.folderId);
      } else {
        // Auto-organize to appropriate folder
        await this.autoOrganizeFile(transferId, fileType);
      }

      // Add to transfer queue
      this.transferQueue.push(transfer as FileTransfer);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.processTransferQueue();
      }

      log.info(`Transfer started: ${transferRequest.filename} (${transferId})`);
      return transferId;
    } catch (error) {
      log.error('Failed to start transfer:', error);
      throw error;
    }
  }

  private async processTransferQueue(): Promise<void> {
    if (this.isProcessing || this.transferQueue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      while (this.transferQueue.length > 0 && this.activeTransfers.size < this.maxConcurrentTransfers) {
        const transfer = this.transferQueue.shift();
        if (transfer) {
          this.executeTransfer(transfer);
        }
      }
    } finally {
      if (this.activeTransfers.size === 0) {
        this.isProcessing = false;
      }
    }
  }

  private async executeTransfer(transfer: FileTransfer): Promise<void> {
    const transferProgress: TransferProgress = {
      id: transfer.id,
      filename: transfer.filename,
      progress: 0,
      status: 'in_progress',
      transferSpeed: 0,
      bytesTransferred: 0,
      estimatedTimeRemaining: 0
    };

    this.activeTransfers.set(transfer.id, transferProgress);

    try {
      // Update status to in_progress
      await this.updateTransferStatus(transfer.id, 'in_progress');
      
      // Ensure destination directory exists
      await fs.promises.mkdir(path.dirname(transfer.destination_path), { recursive: true });

      // Perform the actual file transfer
      await this.copyFileWithProgress(transfer, transferProgress);

      // Verify file integrity
      const destinationChecksum = await this.calculateChecksum(transfer.destination_path);
      if (destinationChecksum !== transfer.checksum) {
        throw new Error('File integrity check failed');
      }

      // Generate thumbnail if it's a media file
      if (transfer.file_type === 'image' || transfer.file_type === 'video') {
        try {
          const thumbnailPath = await this.generateThumbnail(transfer);
          if (thumbnailPath) {
            await this.databaseManager.run(
              'UPDATE file_transfers SET thumbnail_path = ? WHERE id = ?',
              [thumbnailPath, transfer.id]
            );
          }
        } catch (thumbnailError) {
          log.warn(`Failed to generate thumbnail for ${transfer.filename}:`, thumbnailError);
        }
      }

      // Delete source file if requested
      if (transfer.auto_delete_source && transfer.transfer_type === 'import') {
        try {
          await fs.promises.unlink(transfer.source_path);
          log.info(`Source file deleted: ${transfer.source_path}`);
        } catch (deleteError) {
          log.warn(`Failed to delete source file: ${transfer.source_path}`, deleteError);
        }
      }

      // Update status to completed
      await this.updateTransferStatus(transfer.id, 'completed');
      
      log.info(`Transfer completed: ${transfer.filename}`);
    } catch (error) {
      log.error(`Transfer failed: ${transfer.filename}`, error);
      await this.updateTransferStatus(transfer.id, 'failed', error.message);
    } finally {
      this.activeTransfers.delete(transfer.id);
      
      // Continue processing queue
      setTimeout(() => this.processTransferQueue(), 100);
    }
  }

  private async copyFileWithProgress(transfer: FileTransfer, progress: TransferProgress): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(transfer.source_path);
      const writeStream = fs.createWriteStream(transfer.destination_path);
      
      let bytesTransferred = 0;
      const startTime = Date.now();
      
      readStream.on('data', (chunk) => {
        bytesTransferred += chunk.length;
        const currentTime = Date.now();
        const elapsedTime = (currentTime - startTime) / 1000; // seconds
        
        progress.bytesTransferred = bytesTransferred;
        progress.progress = Math.round((bytesTransferred / transfer.file_size) * 100);
        progress.transferSpeed = bytesTransferred / elapsedTime; // bytes per second
        
        const remainingBytes = transfer.file_size - bytesTransferred;
        progress.estimatedTimeRemaining = remainingBytes / progress.transferSpeed;
        
        // Update database every 1MB or 10% progress
        if (bytesTransferred % (1024 * 1024) === 0 || progress.progress % 10 === 0) {
          this.databaseManager.run(
            'UPDATE file_transfers SET progress = ?, transfer_speed = ?, bytes_transferred = ? WHERE id = ?',
            [progress.progress, Math.round(progress.transferSpeed), bytesTransferred, transfer.id]
          ).catch(error => log.warn('Failed to update transfer progress:', error));
        }
      });
      
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      
      readStream.pipe(writeStream);
    });
  }

  private async updateTransferStatus(transferId: string, status: string, errorMessage?: string): Promise<void> {
    const updateFields = ['status = ?'];
    const updateValues = [status];
    
    if (status === 'in_progress') {
      updateFields.push('started_at = ?');
      updateValues.push(new Date().toISOString());
    } else if (status === 'completed' || status === 'failed') {
      updateFields.push('completed_at = ?');
      updateValues.push(new Date().toISOString());
    }
    
    if (errorMessage) {
      updateFields.push('error_message = ?');
      updateValues.push(errorMessage);
    }
    
    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(transferId);
    
    await this.databaseManager.run(
      `UPDATE file_transfers SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
  }

  async pauseTransfer(transferId: string): Promise<void> {
    if (this.activeTransfers.has(transferId)) {
      await this.updateTransferStatus(transferId, 'paused');
      this.activeTransfers.delete(transferId);
      log.info(`Transfer paused: ${transferId}`);
    }
  }

  async resumeTransfer(transferId: string): Promise<void> {
    const transfer = await this.databaseManager.query(
      'SELECT * FROM file_transfers WHERE id = ?',
      [transferId]
    );
    
    if (transfer.length > 0 && transfer[0].status === 'paused') {
      await this.updateTransferStatus(transferId, 'pending');
      this.transferQueue.push(transfer[0]);
      
      if (!this.isProcessing) {
        this.processTransferQueue();
      }
      
      log.info(`Transfer resumed: ${transferId}`);
    }
  }

  async cancelTransfer(transferId: string): Promise<void> {
    // Remove from active transfers
    if (this.activeTransfers.has(transferId)) {
      this.activeTransfers.delete(transferId);
    }
    
    // Remove from queue
    this.transferQueue = this.transferQueue.filter(t => t.id !== transferId);
    
    // Update status
    await this.updateTransferStatus(transferId, 'cancelled');
    
    // Try to delete partially transferred file
    try {
      const transfer = await this.databaseManager.query(
        'SELECT destination_path FROM file_transfers WHERE id = ?',
        [transferId]
      );
      
      if (transfer.length > 0 && fs.existsSync(transfer[0].destination_path)) {
        await fs.promises.unlink(transfer[0].destination_path);
      }
    } catch (error) {
      log.warn(`Failed to clean up cancelled transfer: ${transferId}`, error);
    }
    
    log.info(`Transfer cancelled: ${transferId}`);
  }

  async getTransfers(limit: number = 50, offset: number = 0, filters?: any): Promise<FileTransfer[]> {
    let query = 'SELECT * FROM file_transfers';
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    
    if (filters?.file_type) {
      conditions.push('file_type = ?');
      params.push(filters.file_type);
    }
    
    if (filters?.transfer_type) {
      conditions.push('transfer_type = ?');
      params.push(filters.transfer_type);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return await this.databaseManager.query(query, params);
  }

  async getActiveTransfers(): Promise<TransferProgress[]> {
    return Array.from(this.activeTransfers.values());
  }

  async getTransferStatistics(): Promise<TransferStatistics> {
    const [totalResult, completedResult, failedResult, bytesResult] = await Promise.all([
      this.databaseManager.query('SELECT COUNT(*) as count FROM file_transfers'),
      this.databaseManager.query('SELECT COUNT(*) as count FROM file_transfers WHERE status = ?', ['completed']),
      this.databaseManager.query('SELECT COUNT(*) as count FROM file_transfers WHERE status = ?', ['failed']),
      this.databaseManager.query('SELECT SUM(file_size) as total FROM file_transfers WHERE status = ?', ['completed'])
    ]);

    const transfersByType = await this.databaseManager.query(`
      SELECT file_type, COUNT(*) as count, SUM(file_size) as total_size
      FROM file_transfers
      WHERE status = 'completed'
      GROUP BY file_type
    `);

    const transfersByDate = await this.databaseManager.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count, SUM(file_size) as total_size
      FROM file_transfers
      WHERE status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    const recentTransfers = await this.databaseManager.query(
      'SELECT * FROM file_transfers ORDER BY created_at DESC LIMIT 10'
    );

    const avgSpeedResult = await this.databaseManager.query(
      'SELECT AVG(transfer_speed) as avg_speed FROM file_transfers WHERE status = ? AND transfer_speed > 0',
      ['completed']
    );

    return {
      totalTransfers: totalResult[0]?.count || 0,
      completedTransfers: completedResult[0]?.count || 0,
      failedTransfers: failedResult[0]?.count || 0,
      totalBytesTransferred: bytesResult[0]?.total || 0,
      averageTransferSpeed: avgSpeedResult[0]?.avg_speed || 0,
      transfersByType,
      transfersByDate,
      recentTransfers
    };
  }

  async exportTransfers(format: 'json' | 'csv' | 'txt' = 'json'): Promise<{ success: boolean; filePath?: string; error?: string; exported?: number }> {
    try {
      const transfers = await this.databaseManager.query('SELECT * FROM file_transfers ORDER BY created_at DESC');
      const exportDir = path.join(app.getPath('downloads'), 'UnisonX_Exports');
      await fs.promises.mkdir(exportDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `transfers_export_${timestamp}.${format}`;
      const filePath = path.join(exportDir, filename);

      if (format === 'json') {
        await fs.promises.writeFile(filePath, JSON.stringify(transfers, null, 2));
      } else if (format === 'csv') {
        const headers = Object.keys(transfers[0] || {}).join(',');
        const rows = transfers.map(t => Object.values(t).map(v => `"${v}"`).join(','));
        const csv = [headers, ...rows].join('\n');
        await fs.promises.writeFile(filePath, csv);
      } else if (format === 'txt') {
        const txt = transfers.map(t => 
          `Transfer: ${t.filename}\nStatus: ${t.status}\nSize: ${this.formatFileSize(t.file_size)}\nDate: ${t.created_at}\n---\n`
        ).join('\n');
        await fs.promises.writeFile(filePath, txt);
      }

      return { success: true, filePath, exported: transfers.length };
    } catch (error) {
      log.error('Export transfers failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Folder management methods
  async createFolder(folderData: Omit<FileFolder, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const folderId = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await this.databaseManager.run(`
      INSERT INTO file_folders (id, name, parent_folder_id, folder_type, color, icon, description, auto_organize, auto_organize_rules)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      folderId, folderData.name, folderData.parent_folder_id, folderData.folder_type,
      folderData.color, folderData.icon, folderData.description, folderData.auto_organize,
      folderData.auto_organize_rules
    ]);

    return folderId;
  }

  async getFolders(): Promise<FileFolder[]> {
    return await this.databaseManager.query('SELECT * FROM file_folders ORDER BY folder_type, name');
  }

  async addFileToFolder(transferId: string, folderId: string): Promise<void> {
    const membershipId = `membership-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await this.databaseManager.run(
      'INSERT OR IGNORE INTO file_folder_memberships (id, file_transfer_id, folder_id) VALUES (?, ?, ?)',
      [membershipId, transferId, folderId]
    );
  }

  private async autoOrganizeFile(transferId: string, fileType: string): Promise<void> {
    const folderMap: { [key: string]: string } = {
      'image': 'photos',
      'video': 'videos',
      'document': 'documents'
    };

    const folderId = folderMap[fileType] || 'downloads';
    await this.addFileToFolder(transferId, folderId);
  }

  // Utility methods
  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }

  private getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
    if (mimeType.includes('application')) return 'app';
    return 'other';
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async generateThumbnail(transfer: FileTransfer): Promise<string | null> {
    // Placeholder for thumbnail generation
    // This would typically use a library like sharp for images or ffmpeg for videos
    return null;
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  async cleanup(): Promise<void> {
    // Cancel all active transfers
    for (const transferId of this.activeTransfers.keys()) {
      await this.cancelTransfer(transferId);
    }
    
    this.activeTransfers.clear();
    this.transferQueue = [];
    this.isProcessing = false;
    
    log.info('FileManagerService cleanup completed');
  }
}
import React from 'react';
import { FolderOpen, Upload, Download } from 'lucide-react';

export const FileManager: React.FC = () => {
  return (
    <div className="file-manager p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          File Manager
        </h1>
        <div className="flex items-center space-x-3">
          <button className="button-secondary flex items-center space-x-2">
            <Upload size={16} />
            <span>Upload</span>
          </button>
          <button className="button-secondary flex items-center space-x-2">
            <Download size={16} />
            <span>Download</span>
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="text-center py-12">
          <FolderOpen size={48} className="mx-auto text-gray-400 mb-4" />
          <div className="text-gray-600 dark:text-gray-400 mb-2">
            File Transfer System Coming Soon
          </div>
          <div className="text-sm text-gray-500">
            This feature will be implemented in Phase 6
          </div>
        </div>
      </div>
    </div>
  );
};
import React from 'react';
import { Phone, Filter } from 'lucide-react';

export const CallLogs: React.FC = () => {
  return (
    <div className="call-logs p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Call Logs
        </h1>
        <button className="button-secondary flex items-center space-x-2">
          <Filter size={16} />
          <span>Filter</span>
        </button>
      </div>

      <div className="card p-6">
        <div className="text-center py-12">
          <Phone size={48} className="mx-auto text-gray-400 mb-4" />
          <div className="text-gray-600 dark:text-gray-400 mb-2">
            Call Log Management Coming Soon
          </div>
          <div className="text-sm text-gray-500">
            This feature will be implemented in Phase 5
          </div>
        </div>
      </div>
    </div>
  );
};
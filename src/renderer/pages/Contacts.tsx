import React from 'react';
import { Users, Search, Plus } from 'lucide-react';

export const Contacts: React.FC = () => {
  return (
    <div className="contacts p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Contacts
        </h1>
        <button className="button-primary flex items-center space-x-2">
          <Plus size={16} />
          <span>Add Contact</span>
        </button>
      </div>

      <div className="card p-6">
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <div className="text-gray-600 dark:text-gray-400 mb-2">
            Contact Management Coming Soon
          </div>
          <div className="text-sm text-gray-500">
            This feature will be implemented in Phase 3
          </div>
        </div>
      </div>
    </div>
  );
};
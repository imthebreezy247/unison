import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  Star, 
  Users,
  SortAsc,
  SortDesc 
} from 'lucide-react';

export interface SearchFilters {
  query: string;
  sortBy: 'name' | 'lastContacted' | 'dateAdded';
  sortOrder: 'asc' | 'desc';
  showFavoritesOnly: boolean;
  selectedGroups: string[];
}

export interface ContactGroup {
  id: string;
  name: string;
  contactCount: number;
  color?: string;
}

interface ContactSearchProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  groups: ContactGroup[];
  totalContacts: number;
  filteredContacts: number;
  className?: string;
}

export const ContactSearch: React.FC<ContactSearchProps> = ({
  filters,
  onFiltersChange,
  groups,
  totalContacts,
  filteredContacts,
  className = '',
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.query);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, query: searchQuery });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleGroup = (groupId: string) => {
    const selectedGroups = filters.selectedGroups.includes(groupId)
      ? filters.selectedGroups.filter(id => id !== groupId)
      : [...filters.selectedGroups, groupId];
    
    updateFilter('selectedGroups', selectedGroups);
  };

  const clearFilters = () => {
    setSearchQuery('');
    onFiltersChange({
      query: '',
      sortBy: 'name',
      sortOrder: 'asc',
      showFavoritesOnly: false,
      selectedGroups: [],
    });
  };

  const hasActiveFilters = 
    filters.query ||
    filters.showFavoritesOnly ||
    filters.selectedGroups.length > 0 ||
    filters.sortBy !== 'name' ||
    filters.sortOrder !== 'asc';

  return (
    <div className={`contact-search space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <div className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            showAdvancedFilters || hasActiveFilters
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
          }`}
        >
          <Filter size={16} />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
              {[
                filters.query && 'search',
                filters.showFavoritesOnly && 'favorites',
                filters.selectedGroups.length > 0 && 'groups',
                (filters.sortBy !== 'name' || filters.sortOrder !== 'asc') && 'sort'
              ].filter(Boolean).length}
            </span>
          )}
        </button>
        
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Clear all filters"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
          {/* Sort Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort by
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="name">Name</option>
                <option value="lastContacted">Last Contacted</option>
                <option value="dateAdded">Date Added</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Order
              </label>
              <button
                onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                {filters.sortOrder === 'asc' ? (
                  <SortAsc size={16} />
                ) : (
                  <SortDesc size={16} />
                )}
                <span>{filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
              </button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Quick Filters
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateFilter('showFavoritesOnly', !filters.showFavoritesOnly)}
                className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm transition-colors ${
                  filters.showFavoritesOnly
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                <Star size={14} className={filters.showFavoritesOnly ? 'fill-current' : ''} />
                <span>Favorites Only</span>
              </button>
            </div>
          </div>

          {/* Groups Filter */}
          {groups.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Groups
              </label>
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => toggleGroup(group.id)}
                    className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.selectedGroups.includes(group.id)
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
                    }`}
                  >
                    <Users size={14} />
                    <span>{group.name}</span>
                    <span className="text-xs opacity-75">({group.contactCount})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          Showing {filteredContacts.toLocaleString()} of {totalContacts.toLocaleString()} contacts
        </span>
        
        {hasActiveFilters && (
          <span className="text-blue-600 dark:text-blue-400">
            Filters active
          </span>
        )}
      </div>
    </div>
  );
};
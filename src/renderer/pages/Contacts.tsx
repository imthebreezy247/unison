import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Download, 
  Upload,
  RefreshCw,
  Grid,
  List,
  AlertCircle,
  FileDown,
  FileUp 
} from 'lucide-react';
import { ContactCard, ContactInfo } from '../components/contacts/ContactCard';
import { ContactSearch, SearchFilters, ContactGroup } from '../components/contacts/ContactSearch';
import { ContactDetailModal } from '../components/contacts/ContactDetailModal';
import { useConnection } from '../context/ConnectionContext';

export const Contacts: React.FC = () => {
  const { state } = useConnection();
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedContact, setSelectedContact] = useState<ContactInfo | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [contactGroupMemberships, setContactGroupMemberships] = useState<Map<string, string[]>>(new Map());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    sortBy: 'name',
    sortOrder: 'asc',
    showFavoritesOnly: false,
    selectedGroups: [],
  });

  const [groups, setGroups] = useState<ContactGroup[]>([]);

  useEffect(() => {
    loadContacts();
    loadGroups();
    loadContactGroupMemberships();
  }, []);

  useEffect(() => {
    filterAndSortContacts();
  }, [contacts, filters]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const contactsData = await window.unisonx?.db?.query('SELECT * FROM contacts ORDER BY display_name') || [];
      
      const formattedContacts: ContactInfo[] = contactsData.map((contact: any) => ({
        id: contact.id,
        firstName: contact.first_name || '',
        lastName: contact.last_name || '',
        displayName: contact.display_name || 'Unknown',
        phoneNumbers: JSON.parse(contact.phone_numbers || '[]'),
        emailAddresses: JSON.parse(contact.email_addresses || '[]'),
        avatarUrl: contact.avatar_url,
        organization: contact.organization,
        isFavorite: false, // Will be loaded separately
        lastContacted: contact.last_contacted ? new Date(contact.last_contacted) : undefined,
      }));

      // Load favorites
      const favoritesData = await window.unisonx?.db?.query('SELECT contact_id FROM contact_favorites') || [];
      const favoriteIds = new Set(favoritesData.map((f: any) => f.contact_id));
      
      formattedContacts.forEach(contact => {
        contact.isFavorite = favoriteIds.has(contact.id);
      });

      setContacts(formattedContacts);
      window.unisonx?.log?.info(`Loaded ${formattedContacts.length} contacts`);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      window.unisonx?.log?.error('Failed to load contacts', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const groupsData = await window.unisonx?.contacts?.getGroups() || [];
      
      // Calculate contact count for each group
      const groupsWithCounts = await Promise.all(
        groupsData.map(async (group: any) => {
          try {
            const members = await window.unisonx?.contacts?.getGroupMembers(group.id) || [];
            return {
              id: group.id,
              name: group.name,
              color: group.color,
              contactCount: members.length
            };
          } catch (error) {
            console.error(`Failed to get members for group ${group.id}:`, error);
            return {
              id: group.id,
              name: group.name,
              color: group.color,
              contactCount: 0
            };
          }
        })
      );

      setGroups(groupsWithCounts);
      window.unisonx?.log?.info(`Loaded ${groupsWithCounts.length} contact groups`);
    } catch (error) {
      console.error('Failed to load groups:', error);
      window.unisonx?.log?.error('Failed to load groups', error);
    }
  };

  const loadContactGroupMemberships = async () => {
    try {
      const membershipsData = await window.unisonx?.db?.query(`
        SELECT contact_id, group_id FROM contact_group_memberships
      `) || [];
      
      const memberships = new Map<string, string[]>();
      membershipsData.forEach((membership: any) => {
        const contactId = membership.contact_id;
        const groupId = membership.group_id;
        
        if (!memberships.has(contactId)) {
          memberships.set(contactId, []);
        }
        memberships.get(contactId)!.push(groupId);
      });
      
      setContactGroupMemberships(memberships);
      window.unisonx?.log?.info(`Loaded group memberships for ${memberships.size} contacts`);
    } catch (error) {
      console.error('Failed to load contact group memberships:', error);
      window.unisonx?.log?.error('Failed to load contact group memberships', error);
    }
  };

  const filterAndSortContacts = () => {
    let filtered = [...contacts];

    // Apply search filter
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.displayName.toLowerCase().includes(query) ||
        contact.firstName.toLowerCase().includes(query) ||
        contact.lastName.toLowerCase().includes(query) ||
        contact.phoneNumbers.some(phone => phone.includes(query)) ||
        contact.emailAddresses.some(email => email.toLowerCase().includes(query)) ||
        (contact.organization && contact.organization.toLowerCase().includes(query))
      );
    }

    // Apply favorites filter
    if (filters.showFavoritesOnly) {
      filtered = filtered.filter(contact => contact.isFavorite);
    }

    // Apply group filters
    if (filters.selectedGroups.length > 0) {
      filtered = filtered.filter(contact => {
        const contactGroups = contactGroupMemberships.get(contact.id) || [];
        return filters.selectedGroups.some(groupId => contactGroups.includes(groupId));
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case 'lastContacted':
          const aDate = a.lastContacted?.getTime() || 0;
          const bDate = b.lastContacted?.getTime() || 0;
          comparison = bDate - aDate; // Most recent first
          break;
        case 'dateAdded':
          // Placeholder - would use actual creation date
          comparison = a.displayName.localeCompare(b.displayName);
          break;
      }
      
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    setFilteredContacts(filtered);
  };

  const handleSyncContacts = async () => {
    if (!state.activeDevice?.connected) {
      window.unisonx?.log?.error('No device connected for sync');
      return;
    }

    try {
      setSyncing(true);
      window.unisonx?.log?.info('Starting contact sync...');
      
      // In a real implementation, would trigger contact sync
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate sync
      
      await loadContacts();
      window.unisonx?.log?.info('Contact sync completed');
    } catch (error) {
      console.error('Contact sync failed:', error);
      window.unisonx?.log?.error('Contact sync failed', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleEditContact = (contact: ContactInfo) => {
    setSelectedContact(contact);
    setIsEditing(true);
    setIsDetailModalOpen(true);
    window.unisonx?.log?.info(`Editing contact: ${contact.displayName}`);
  };

  const handleViewContact = (contact: ContactInfo) => {
    setSelectedContact(contact);
    setIsEditing(false);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedContact(null);
    setIsEditing(false);
  };

  const handleSaveContact = async (updatedContact: ContactInfo) => {
    try {
      // Update contact in database
      await window.unisonx?.db?.run(`
        UPDATE contacts 
        SET first_name = ?, last_name = ?, display_name = ?, 
            phone_numbers = ?, email_addresses = ?, organization = ?
        WHERE id = ?
      `, [
        updatedContact.firstName,
        updatedContact.lastName,
        updatedContact.displayName,
        JSON.stringify(updatedContact.phoneNumbers),
        JSON.stringify(updatedContact.emailAddresses),
        updatedContact.organization,
        updatedContact.id
      ]);

      // Update local state
      setContacts(prev => prev.map(contact =>
        contact.id === updatedContact.id ? updatedContact : contact
      ));

      window.unisonx?.log?.info(`Contact updated: ${updatedContact.displayName}`);
    } catch (error) {
      console.error('Failed to save contact:', error);
      window.unisonx?.log?.error('Failed to save contact', error);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      await window.unisonx?.db?.run('DELETE FROM contacts WHERE id = ?', [contactId]);
      await window.unisonx?.db?.run('DELETE FROM contact_favorites WHERE contact_id = ?', [contactId]);
      
      // Close modal if this contact was being viewed
      if (selectedContact?.id === contactId) {
        handleCloseDetailModal();
      }
      
      await loadContacts();
      window.unisonx?.log?.info(`Contact deleted: ${contactId}`);
    } catch (error) {
      console.error('Failed to delete contact:', error);
      window.unisonx?.log?.error('Failed to delete contact', error);
    }
  };

  const handleToggleFavorite = async (contactId: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        await window.unisonx?.db?.run('INSERT OR IGNORE INTO contact_favorites (contact_id) VALUES (?)', [contactId]);
      } else {
        await window.unisonx?.db?.run('DELETE FROM contact_favorites WHERE contact_id = ?', [contactId]);
      }
      
      // Update local state
      setContacts(prev => prev.map(contact =>
        contact.id === contactId ? { ...contact, isFavorite } : contact
      ));
      
      window.unisonx?.log?.info(`Contact ${isFavorite ? 'added to' : 'removed from'} favorites: ${contactId}`);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      window.unisonx?.log?.error('Failed to toggle favorite', error);
    }
  };

  const handleStartMessage = (contact: ContactInfo) => {
    window.unisonx?.log?.info(`Starting message with: ${contact.displayName}`);
    // In a real implementation, would navigate to messages with this contact
  };

  const handleCall = (phoneNumber: string) => {
    window.unisonx?.log?.info(`Calling: ${phoneNumber}`);
    // In a real implementation, would initiate call
  };

  const handleExportCSV = async () => {
    try {
      setShowExportMenu(false);
      window.unisonx?.log?.info('Exporting contacts to CSV...');
      
      const result = await window.unisonx?.contacts?.exportCSV();
      if (result?.success) {
        window.unisonx?.log?.info(`Exported ${result.exported} contacts to ${result.filePath}`);
        alert(`Successfully exported ${result.exported} contacts to CSV!`);
      } else {
        alert(`Export failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export contacts to CSV');
    }
  };

  const handleExportVCard = async () => {
    try {
      setShowExportMenu(false);
      window.unisonx?.log?.info('Exporting contacts to vCard...');
      
      const result = await window.unisonx?.contacts?.exportVCard();
      if (result?.success) {
        window.unisonx?.log?.info(`Exported ${result.exported} contacts to ${result.filePath}`);
        alert(`Successfully exported ${result.exported} contacts to vCard!`);
      } else {
        alert(`Export failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to export vCard:', error);
      alert('Failed to export contacts to vCard');
    }
  };

  const handleImportCSV = async () => {
    try {
      setShowImportMenu(false);
      window.unisonx?.log?.info('Importing contacts from CSV...');
      
      const result = await window.unisonx?.contacts?.importCSV();
      if (result?.success) {
        await loadContacts(); // Refresh contact list
        let message = `Successfully imported ${result.imported} contacts!`;
        if (result.duplicates > 0) {
          message += `\n${result.duplicates} duplicates were skipped.`;
        }
        if (result.errors.length > 0) {
          message += `\n${result.errors.length} errors occurred.`;
        }
        alert(message);
        window.unisonx?.log?.info(`Import completed: ${result.imported} imported, ${result.duplicates} duplicates, ${result.errors.length} errors`);
      } else {
        const errorMsg = result?.errors?.join('\n') || 'Unknown error';
        alert(`Import failed:\n${errorMsg}`);
      }
    } catch (error) {
      console.error('Failed to import CSV:', error);
      alert('Failed to import contacts from CSV');
    }
  };

  const handleImportVCard = async () => {
    try {
      setShowImportMenu(false);
      window.unisonx?.log?.info('Importing contacts from vCard...');
      
      const result = await window.unisonx?.contacts?.importVCard();
      if (result?.success) {
        await loadContacts(); // Refresh contact list
        let message = `Successfully imported ${result.imported} contacts!`;
        if (result.duplicates > 0) {
          message += `\n${result.duplicates} duplicates were skipped.`;
        }
        if (result.errors.length > 0) {
          message += `\n${result.errors.length} errors occurred.`;
        }
        alert(message);
        window.unisonx?.log?.info(`Import completed: ${result.imported} imported, ${result.duplicates} duplicates, ${result.errors.length} errors`);
      } else {
        const errorMsg = result?.errors?.join('\n') || 'Unknown error';
        alert(`Import failed:\n${errorMsg}`);
      }
    } catch (error) {
      console.error('Failed to import vCard:', error);
      alert('Failed to import contacts from vCard');
    }
  };

  const handleExportSelected = async (format: 'csv' | 'vcard') => {
    try {
      const contactIds = Array.from(selectedContacts);
      window.unisonx?.log?.info(`Exporting ${contactIds.length} selected contacts to ${format}...`);
      
      const result = await window.unisonx?.contacts?.exportSelected(contactIds, format);
      if (result?.success) {
        window.unisonx?.log?.info(`Exported ${result.exported} contacts to ${result.filePath}`);
        alert(`Successfully exported ${result.exported} selected contacts to ${format.toUpperCase()}!`);
        setSelectedContacts(new Set()); // Clear selection
      } else {
        alert(`Export failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Failed to export selected contacts to ${format}:`, error);
      alert(`Failed to export selected contacts to ${format.toUpperCase()}`);
    }
  };

  const handleAddContact = () => {
    // Create a new empty contact and open the modal in edit mode
    const newContact: ContactInfo = {
      id: `new-contact-${Date.now()}`,
      firstName: '',
      lastName: '',
      displayName: 'New Contact',
      phoneNumbers: [''],
      emailAddresses: [''],
      isFavorite: false
    };
    
    setSelectedContact(newContact);
    setIsEditing(true);
    setIsDetailModalOpen(true);
    window.unisonx?.log?.info('Adding new contact...');
  };

  const handleSaveNewContact = async (contactData: ContactInfo) => {
    try {
      // For new contacts, insert into database
      if (contactData.id.startsWith('new-contact-')) {
        const contactId = `contact-${Date.now()}`;
        await window.unisonx?.db?.run(`
          INSERT INTO contacts (id, first_name, last_name, display_name, phone_numbers, email_addresses, organization)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          contactId,
          contactData.firstName,
          contactData.lastName,
          contactData.displayName,
          JSON.stringify(contactData.phoneNumbers.filter(p => p.trim())),
          JSON.stringify(contactData.emailAddresses.filter(e => e.trim())),
          contactData.organization || null
        ]);
        
        window.unisonx?.log?.info(`New contact created: ${contactData.displayName}`);
        await loadContacts(); // Reload to show the new contact
      } else {
        // For existing contacts, use the regular save logic
        await handleSaveContact(contactData);
      }
    } catch (error) {
      console.error('Failed to save new contact:', error);
      window.unisonx?.log?.error('Failed to save new contact', error);
    }
  };

  if (loading) {
    return (
      <div className="contacts p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="loading-spinner w-8 h-8 mr-3"></div>
          <span className="text-gray-600 dark:text-gray-400">Loading contacts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="contacts p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Contacts
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {contacts.length.toLocaleString()} contacts • {filteredContacts.length.toLocaleString()} shown
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* View Toggle */}
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-l-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-r-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <List size={16} />
            </button>
          </div>
          
          {/* Action Buttons */}
          <button
            onClick={handleSyncContacts}
            disabled={!state.activeDevice?.connected || syncing}
            className="button-secondary flex items-center space-x-2"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>
          
          {/* Import Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="button-secondary flex items-center space-x-2"
            >
              <Upload size={16} />
              <span>Import</span>
            </button>
            
            {showImportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="py-1">
                  <button
                    onClick={handleImportCSV}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FileUp size={16} />
                    <span>Import from CSV</span>
                  </button>
                  <button
                    onClick={handleImportVCard}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FileUp size={16} />
                    <span>Import from vCard</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="button-secondary flex items-center space-x-2"
            >
              <Download size={16} />
              <span>Export</span>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="py-1">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FileDown size={16} />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    onClick={handleExportVCard}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FileDown size={16} />
                    <span>Export as vCard</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={handleAddContact}
            className="button-primary flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* No Device Warning */}
      {!state.activeDevice?.connected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400" />
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                No Device Connected
              </h3>
              <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
                Connect your iPhone to sync contacts and access all features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <ContactSearch
        filters={filters}
        onFiltersChange={setFilters}
        groups={groups}
        totalContacts={contacts.length}
        filteredContacts={filteredContacts.length}
      />

      {/* Contacts Grid/List */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <div className="text-gray-600 dark:text-gray-400 mb-2">
            {contacts.length === 0 ? 'No contacts found' : 'No contacts match your search'}
          </div>
          <div className="text-sm text-gray-500">
            {contacts.length === 0 
              ? 'Sync your iPhone to import contacts' 
              : 'Try adjusting your search or filters'
            }
          </div>
        </div>
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-2'
        }>
          {filteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleEditContact}
              onDelete={handleDeleteContact}
              onToggleFavorite={handleToggleFavorite}
              onStartMessage={handleStartMessage}
              onCall={handleCall}
              onView={handleViewContact}
              className={viewMode === 'list' ? 'max-w-none' : ''}
            />
          ))}
        </div>
      )}

      {/* Bulk Actions (when contacts are selected) */}
      {selectedContacts.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedContacts.size} selected
            </span>
            <button className="button-secondary text-sm">
              Export Selected
            </button>
            <button className="button-secondary text-sm text-red-600">
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedContacts(new Set())}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contact Detail Modal */}
      <ContactDetailModal
        contact={selectedContact}
        isOpen={isDetailModalOpen}
        isEditing={isEditing}
        onClose={handleCloseDetailModal}
        onSave={selectedContact?.id.startsWith('new-contact-') ? handleSaveNewContact : handleSaveContact}
        onDelete={handleDeleteContact}
        onToggleFavorite={handleToggleFavorite}
        onStartMessage={handleStartMessage}
        onCall={handleCall}
      />
    </div>
  );
};
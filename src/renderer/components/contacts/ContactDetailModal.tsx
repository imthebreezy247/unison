import React, { useState, useEffect } from 'react';
import { 
  X, 
  Edit, 
  Save, 
  Trash2, 
  Plus, 
  Phone, 
  Mail, 
  User,
  MapPin,
  Calendar,
  Star,
  StarOff,
  MessageSquare
} from 'lucide-react';
import { ContactInfo } from './ContactCard';

interface ContactDetailModalProps {
  contact: ContactInfo | null;
  isOpen: boolean;
  isEditing: boolean;
  onClose: () => void;
  onSave: (contact: ContactInfo) => void;
  onDelete: (contactId: string) => void;
  onToggleFavorite: (contactId: string, isFavorite: boolean) => void;
  onStartMessage: (contact: ContactInfo) => void;
  onCall: (phoneNumber: string) => void;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
  contact,
  isOpen,
  isEditing: initialEditing,
  onClose,
  onSave,
  onDelete,
  onToggleFavorite,
  onStartMessage,
  onCall,
}) => {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [editedContact, setEditedContact] = useState<ContactInfo | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (contact) {
      setEditedContact({ ...contact });
      setIsEditing(initialEditing);
      setErrors({});
    }
  }, [contact, initialEditing]);

  if (!isOpen || !contact) {
    return null;
  }

  const handleSave = () => {
    if (!editedContact) return;

    // Validate form
    const newErrors: { [key: string]: string } = {};
    
    if (!editedContact.firstName.trim() && !editedContact.lastName.trim()) {
      newErrors.name = 'First name or last name is required';
    }
    
    if (editedContact.phoneNumbers.length === 0 && editedContact.emailAddresses.length === 0) {
      newErrors.contact = 'At least one phone number or email address is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Update display name
    const displayName = `${editedContact.firstName} ${editedContact.lastName}`.trim() || 'Unknown';
    const finalContact = { ...editedContact, displayName };

    onSave(finalContact);
    setIsEditing(false);
    setErrors({});
  };

  const handleCancel = () => {
    setEditedContact({ ...contact });
    setIsEditing(false);
    setErrors({});
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${contact.displayName}?`)) {
      onDelete(contact.id);
      onClose();
    }
  };

  const addPhoneNumber = () => {
    if (!editedContact) return;
    setEditedContact({
      ...editedContact,
      phoneNumbers: [...editedContact.phoneNumbers, '']
    });
  };

  const removePhoneNumber = (index: number) => {
    if (!editedContact) return;
    setEditedContact({
      ...editedContact,
      phoneNumbers: editedContact.phoneNumbers.filter((_, i) => i !== index)
    });
  };

  const updatePhoneNumber = (index: number, value: string) => {
    if (!editedContact) return;
    const newNumbers = [...editedContact.phoneNumbers];
    newNumbers[index] = value;
    setEditedContact({
      ...editedContact,
      phoneNumbers: newNumbers
    });
  };

  const addEmailAddress = () => {
    if (!editedContact) return;
    setEditedContact({
      ...editedContact,
      emailAddresses: [...editedContact.emailAddresses, '']
    });
  };

  const removeEmailAddress = (index: number) => {
    if (!editedContact) return;
    setEditedContact({
      ...editedContact,
      emailAddresses: editedContact.emailAddresses.filter((_, i) => i !== index)
    });
  };

  const updateEmailAddress = (index: number, value: string) => {
    if (!editedContact) return;
    const newEmails = [...editedContact.emailAddresses];
    newEmails[index] = value;
    setEditedContact({
      ...editedContact,
      emailAddresses: newEmails
    });
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-medium">
              {contact.avatarUrl ? (
                <img 
                  src={contact.avatarUrl} 
                  alt={contact.displayName}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <span>{getInitials(contact.firstName, contact.lastName)}</span>
              )}
            </div>
            
            {/* Name and Favorite */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {contact.displayName}
              </h2>
              {contact.organization && (
                <p className="text-gray-600 dark:text-gray-400">
                  {contact.organization}
                </p>
              )}
              <button
                onClick={() => onToggleFavorite(contact.id, !contact.isFavorite)}
                className="flex items-center space-x-1 text-sm text-gray-500 hover:text-yellow-500 transition-colors mt-1"
              >
                {contact.isFavorite ? (
                  <Star size={16} className="fill-current text-yellow-500" />
                ) : (
                  <StarOff size={16} />
                )}
                <span>{contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}</span>
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                  title="Edit contact"
                >
                  <Edit size={20} />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                  title="Delete contact"
                >
                  <Trash2 size={20} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="button-primary flex items-center space-x-1 text-sm"
                >
                  <Save size={16} />
                  <span>Save</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="button-secondary text-sm"
                >
                  Cancel
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isEditing && editedContact ? (
            /* Edit Mode */
            <div className="space-y-6">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editedContact.firstName}
                    onChange={(e) => setEditedContact({ ...editedContact, firstName: e.target.value })}
                    className="input-field w-full"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editedContact.lastName}
                    onChange={(e) => setEditedContact({ ...editedContact, lastName: e.target.value })}
                    className="input-field w-full"
                    placeholder="Last name"
                  />
                </div>
              </div>
              
              {errors.name && (
                <p className="text-red-600 text-sm">{errors.name}</p>
              )}

              {/* Organization */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Organization
                </label>
                <input
                  type="text"
                  value={editedContact.organization || ''}
                  onChange={(e) => setEditedContact({ ...editedContact, organization: e.target.value })}
                  className="input-field w-full"
                  placeholder="Organization"
                />
              </div>

              {/* Phone Numbers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone Numbers
                  </label>
                  <button
                    onClick={addPhoneNumber}
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {editedContact.phoneNumbers.map((phone, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => updatePhoneNumber(index, e.target.value)}
                        className="input-field flex-1"
                        placeholder="Phone number"
                      />
                      <button
                        onClick={() => removePhoneNumber(index)}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email Addresses */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Addresses
                  </label>
                  <button
                    onClick={addEmailAddress}
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {editedContact.emailAddresses.map((email, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => updateEmailAddress(index, e.target.value)}
                        className="input-field flex-1"
                        placeholder="Email address"
                      />
                      <button
                        onClick={() => removeEmailAddress(index)}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {errors.contact && (
                <p className="text-red-600 text-sm">{errors.contact}</p>
              )}
            </div>
          ) : (
            /* View Mode */
            <div className="space-y-6">
              {/* Phone Numbers */}
              {contact.phoneNumbers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center space-x-2">
                    <Phone size={16} />
                    <span>Phone Numbers</span>
                  </h3>
                  <div className="space-y-2">
                    {contact.phoneNumbers.map((phone, index) => (
                      <div key={index} className="flex items-center justify-between group">
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatPhoneNumber(phone)}
                        </span>
                        <button
                          onClick={() => onCall(phone)}
                          className="opacity-0 group-hover:opacity-100 text-green-600 hover:text-green-700 transition-all text-sm px-3 py-1 rounded bg-green-50 hover:bg-green-100"
                        >
                          Call
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Addresses */}
              {contact.emailAddresses.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center space-x-2">
                    <Mail size={16} />
                    <span>Email Addresses</span>
                  </h3>
                  <div className="space-y-2">
                    {contact.emailAddresses.map((email, index) => (
                      <div key={index} className="flex items-center justify-between group">
                        <span className="text-gray-900 dark:text-gray-100">
                          {email}
                        </span>
                        <a
                          href={`mailto:${email}`}
                          className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700 transition-all text-sm px-3 py-1 rounded bg-blue-50 hover:bg-blue-100"
                        >
                          Email
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Organization */}
              {contact.organization && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center space-x-2">
                    <User size={16} />
                    <span>Organization</span>
                  </h3>
                  <p className="text-gray-900 dark:text-gray-100">
                    {contact.organization}
                  </p>
                </div>
              )}

              {/* Last Contacted */}
              {contact.lastContacted && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center space-x-2">
                    <Calendar size={16} />
                    <span>Last Contacted</span>
                  </h3>
                  <p className="text-gray-900 dark:text-gray-100">
                    {contact.lastContacted.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => onStartMessage(contact)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                >
                  <MessageSquare size={18} />
                  <span>Send Message</span>
                </button>
                
                {contact.phoneNumbers.length > 0 && (
                  <button
                    onClick={() => onCall(contact.phoneNumbers[0])}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
                  >
                    <Phone size={18} />
                    <span>Call</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
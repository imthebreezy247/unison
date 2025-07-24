import React from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  Star, 
  StarOff,
  Edit,
  Trash2,
  MessageSquare 
} from 'lucide-react';

export interface ContactInfo {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phoneNumbers: string[];
  emailAddresses: string[];
  avatarUrl?: string;
  isFavorite?: boolean;
  lastContacted?: Date;
  organization?: string;
}

interface ContactCardProps {
  contact: ContactInfo;
  onEdit: (contact: ContactInfo) => void;
  onDelete: (contactId: string) => void;
  onToggleFavorite: (contactId: string, isFavorite: boolean) => void;
  onStartMessage: (contact: ContactInfo) => void;
  onCall: (phoneNumber: string) => void;
  onView?: (contact: ContactInfo) => void;
  className?: string;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onEdit,
  onDelete,
  onToggleFavorite,
  onStartMessage,
  onCall,
  onView,
  className = '',
}) => {
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatPhoneNumber = (phone: string) => {
    // Simple US phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div 
      className={`contact-card bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer ${className}`}
      onClick={() => onView?.(contact)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
            {contact.avatarUrl ? (
              <img 
                src={contact.avatarUrl} 
                alt={contact.displayName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <span>{getInitials(contact.firstName, contact.lastName)}</span>
            )}
          </div>
          
          {/* Name and info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {contact.displayName}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(contact.id, !contact.isFavorite);
                }}
                className="text-gray-400 hover:text-yellow-500 transition-colors"
              >
                {contact.isFavorite ? (
                  <Star size={16} className="fill-current text-yellow-500" />
                ) : (
                  <StarOff size={16} />
                )}
              </button>
            </div>
            
            {contact.organization && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {contact.organization}
              </p>
            )}
            
            {contact.lastContacted && (
              <p className="text-xs text-gray-400">
                Last contact: {contact.lastContacted.toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(contact);
            }}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit contact"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(contact.id);
            }}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete contact"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {/* Contact Information */}
      <div className="space-y-2">
        {/* Phone Numbers */}
        {contact.phoneNumbers.length > 0 && (
          <div className="space-y-1">
            {contact.phoneNumbers.slice(0, 2).map((phone, index) => (
              <div key={index} className="flex items-center justify-between group">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <Phone size={14} />
                  <span>{formatPhoneNumber(phone)}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCall(phone);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-green-600 hover:text-green-700 transition-all text-xs px-2 py-1 rounded bg-green-50 hover:bg-green-100"
                >
                  Call
                </button>
              </div>
            ))}
            {contact.phoneNumbers.length > 2 && (
              <p className="text-xs text-gray-400">
                +{contact.phoneNumbers.length - 2} more
              </p>
            )}
          </div>
        )}
        
        {/* Email Addresses */}
        {contact.emailAddresses.length > 0 && (
          <div className="space-y-1">
            {contact.emailAddresses.slice(0, 1).map((email, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <Mail size={14} />
                <span className="truncate">{email}</span>
              </div>
            ))}
            {contact.emailAddresses.length > 1 && (
              <p className="text-xs text-gray-400">
                +{contact.emailAddresses.length - 1} more
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex space-x-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartMessage(contact);
          }}
          className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors"
        >
          <MessageSquare size={14} />
          <span>Message</span>
        </button>
        
        {contact.phoneNumbers.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCall(contact.phoneNumbers[0]);
            }}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-sm bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors"
          >
            <Phone size={14} />
            <span>Call</span>
          </button>
        )}
      </div>
    </div>
  );
};
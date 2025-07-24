import * as fs from 'fs';
import * as path from 'path';
import { app, dialog } from 'electron';
import log from 'electron-log';
import { DatabaseManager } from '../database/DatabaseManager';

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  duplicates: number;
}

export interface ExportResult {
  success: boolean;
  exported: number;
  filePath?: string;
  error?: string;
}

export class ContactImportExportService {
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  async exportToCSV(contacts: any[]): Promise<ExportResult> {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'Export Contacts as CSV',
        defaultPath: path.join(app.getPath('downloads'), 'contacts.csv'),
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!filePath) {
        return { success: false, exported: 0, error: 'Export cancelled' };
      }

      // CSV Header
      const headers = [
        'First Name',
        'Last Name', 
        'Display Name',
        'Phone Numbers',
        'Email Addresses',
        'Organization',
        'Last Contacted'
      ];

      // Convert contacts to CSV rows
      const csvRows = [headers.join(',')];
      
      contacts.forEach(contact => {
        const row = [
          this.escapeCsvValue(contact.first_name || ''),
          this.escapeCsvValue(contact.last_name || ''),
          this.escapeCsvValue(contact.display_name || ''),
          this.escapeCsvValue(contact.phone_numbers || '[]'),
          this.escapeCsvValue(contact.email_addresses || '[]'),
          this.escapeCsvValue(contact.organization || ''),
          this.escapeCsvValue(contact.last_contacted || '')
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      await fs.promises.writeFile(filePath, csvContent, 'utf8');

      log.info(`Exported ${contacts.length} contacts to CSV: ${filePath}`);
      return {
        success: true,
        exported: contacts.length,
        filePath
      };
    } catch (error) {
      log.error('CSV export error:', error);
      return {
        success: false,
        exported: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async exportToVCard(contacts: any[]): Promise<ExportResult> {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'Export Contacts as vCard',
        defaultPath: path.join(app.getPath('downloads'), 'contacts.vcf'),
        filters: [
          { name: 'vCard Files', extensions: ['vcf'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!filePath) {
        return { success: false, exported: 0, error: 'Export cancelled' };
      }

      const vCardEntries = contacts.map(contact => this.generateVCard(contact));
      const vCardContent = vCardEntries.join('\r\n\r\n');

      await fs.promises.writeFile(filePath, vCardContent, 'utf8');

      log.info(`Exported ${contacts.length} contacts to vCard: ${filePath}`);
      return {
        success: true,
        exported: contacts.length,
        filePath
      };
    } catch (error) {
      log.error('vCard export error:', error);
      return {
        success: false,
        exported: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async importFromCSV(): Promise<ImportResult> {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Import Contacts from CSV',
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (!filePaths || filePaths.length === 0) {
        return { success: false, imported: 0, errors: ['Import cancelled'], duplicates: 0 };
      }

      const filePath = filePaths[0];
      const csvContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        return { success: false, imported: 0, errors: ['CSV file is empty or invalid'], duplicates: 0 };
      }

      // Skip header row
      const contactLines = lines.slice(1);
      let imported = 0;
      let duplicates = 0;
      const errors: string[] = [];

      for (let i = 0; i < contactLines.length; i++) {
        try {
          const fields = this.parseCSVLine(contactLines[i]);
          
          if (fields.length < 3) {
            errors.push(`Line ${i + 2}: Insufficient fields`);
            continue;
          }

          const [firstName, lastName, displayName, phoneNumbers, emailAddresses, organization, lastContacted] = fields;

          // Check for duplicates
          const existingContact = await this.databaseManager.query(
            'SELECT id FROM contacts WHERE display_name = ? OR (first_name = ? AND last_name = ?)',
            [displayName, firstName, lastName]
          );

          if (existingContact.length > 0) {
            duplicates++;
            continue;
          }

          const contactId = `imported-${Date.now()}-${i}`;
          
          await this.databaseManager.run(`
            INSERT INTO contacts (id, first_name, last_name, display_name, phone_numbers, email_addresses, organization, last_contacted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            contactId,
            firstName || null,
            lastName || null,
            displayName || `${firstName} ${lastName}`.trim() || 'Unknown',
            phoneNumbers || '[]',
            emailAddresses || '[]',
            organization || null,
            lastContacted || null
          ]);

          imported++;
        } catch (error) {
          errors.push(`Line ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      log.info(`CSV import completed: ${imported} imported, ${duplicates} duplicates, ${errors.length} errors`);
      return {
        success: true,
        imported,
        duplicates,
        errors
      };
    } catch (error) {
      log.error('CSV import error:', error);
      return {
        success: false,
        imported: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duplicates: 0
      };
    }
  }

  async importFromVCard(): Promise<ImportResult> {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Import Contacts from vCard',
        filters: [
          { name: 'vCard Files', extensions: ['vcf'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (!filePaths || filePaths.length === 0) {
        return { success: false, imported: 0, errors: ['Import cancelled'], duplicates: 0 };
      }

      const filePath = filePaths[0];
      const vCardContent = await fs.promises.readFile(filePath, 'utf8');
      const vCards = this.parseVCardFile(vCardContent);

      let imported = 0;
      let duplicates = 0;
      const errors: string[] = [];

      for (let i = 0; i < vCards.length; i++) {
        try {
          const vCard = vCards[i];
          const contact = this.parseVCard(vCard);

          if (!contact.displayName) {
            errors.push(`vCard ${i + 1}: No name found`);
            continue;
          }

          // Check for duplicates
          const existingContact = await this.databaseManager.query(
            'SELECT id FROM contacts WHERE display_name = ?',
            [contact.displayName]
          );

          if (existingContact.length > 0) {
            duplicates++;
            continue;
          }

          const contactId = `imported-${Date.now()}-${i}`;

          await this.databaseManager.run(`
            INSERT INTO contacts (id, first_name, last_name, display_name, phone_numbers, email_addresses, organization)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            contactId,
            contact.firstName || null,
            contact.lastName || null,
            contact.displayName,
            JSON.stringify(contact.phoneNumbers),
            JSON.stringify(contact.emailAddresses),
            contact.organization || null
          ]);

          imported++;
        } catch (error) {
          errors.push(`vCard ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      log.info(`vCard import completed: ${imported} imported, ${duplicates} duplicates, ${errors.length} errors`);
      return {
        success: true,
        imported,
        duplicates,
        errors
      };
    } catch (error) {
      log.error('vCard import error:', error);
      return {
        success: false,
        imported: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duplicates: 0
      };
    }
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    fields.push(current.trim());
    return fields;
  }

  private generateVCard(contact: any): string {
    const phoneNumbers = JSON.parse(contact.phone_numbers || '[]');
    const emailAddresses = JSON.parse(contact.email_addresses || '[]');
    
    let vCard = 'BEGIN:VCARD\r\nVERSION:3.0\r\n';
    
    // Name
    vCard += `FN:${contact.display_name}\r\n`;
    if (contact.first_name || contact.last_name) {
      vCard += `N:${contact.last_name || ''};${contact.first_name || ''};;;\r\n`;
    }
    
    // Organization
    if (contact.organization) {
      vCard += `ORG:${contact.organization}\r\n`;
    }
    
    // Phone numbers
    phoneNumbers.forEach((phone: string, index: number) => {
      const type = index === 0 ? 'CELL' : 'VOICE';
      vCard += `TEL;TYPE=${type}:${phone}\r\n`;
    });
    
    // Email addresses
    emailAddresses.forEach((email: string, index: number) => {
      const type = index === 0 ? 'PREF' : 'INTERNET';
      vCard += `EMAIL;TYPE=${type}:${email}\r\n`;
    });
    
    vCard += 'END:VCARD';
    return vCard;
  }

  private parseVCardFile(content: string): string[] {
    const vCards: string[] = [];
    const lines = content.split(/\r?\n/);
    let currentVCard: string[] = [];
    let inVCard = false;

    for (const line of lines) {
      if (line.trim() === 'BEGIN:VCARD') {
        inVCard = true;
        currentVCard = [line];
      } else if (line.trim() === 'END:VCARD') {
        currentVCard.push(line);
        vCards.push(currentVCard.join('\r\n'));
        currentVCard = [];
        inVCard = false;
      } else if (inVCard) {
        currentVCard.push(line);
      }
    }

    return vCards;
  }

  private parseVCard(vCardText: string): any {
    const lines = vCardText.split(/\r?\n/);
    const contact: any = {
      firstName: '',
      lastName: '',
      displayName: '',
      phoneNumbers: [],
      emailAddresses: [],
      organization: ''
    };

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const field = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);

      if (field === 'FN') {
        contact.displayName = value;
      } else if (field === 'N') {
        const nameParts = value.split(';');
        contact.lastName = nameParts[0] || '';
        contact.firstName = nameParts[1] || '';
      } else if (field.startsWith('TEL')) {
        contact.phoneNumbers.push(value);
      } else if (field.startsWith('EMAIL')) {
        contact.emailAddresses.push(value);
      } else if (field === 'ORG') {
        contact.organization = value;
      }
    }

    // Ensure display name
    if (!contact.displayName) {
      contact.displayName = `${contact.firstName} ${contact.lastName}`.trim() || 'Unknown';
    }

    return contact;
  }
}
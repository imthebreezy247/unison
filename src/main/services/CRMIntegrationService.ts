import { EventEmitter } from 'events';
import log from 'electron-log';
import { DatabaseManager, Contact } from '../database/DatabaseManager';
import { WindowsUIAutomation } from './WindowsUIAutomation';

export interface CRMConfig {
  apiEndpoint: string;
  apiKey: string;
  clientId: string;
  enabled: boolean;
  autoSyncContacts: boolean;
  autoSyncMessages: boolean;
  campaignEnabled: boolean;
}

export interface CampaignContact {
  id: string;
  phoneNumber: string;
  name: string;
  tags: string[];
  lastInteraction?: Date;
  campaignHistory: CampaignMessage[];
}

export interface CampaignMessage {
  id: string;
  contactId: string;
  message: string;
  scheduledTime: Date;
  sentTime?: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  campaignId: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  messageTemplate: string;
  contactFilter: string; // SQL-like filter
  scheduledStart: Date;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

export class CRMIntegrationService extends EventEmitter {
  private databaseManager: DatabaseManager;
  private phoneAutomation: WindowsUIAutomation;
  private config: CRMConfig;
  private campaignInterval: NodeJS.Timeout | null = null;

  constructor(databaseManager: DatabaseManager, phoneAutomation: WindowsUIAutomation) {
    super();
    this.databaseManager = databaseManager;
    this.phoneAutomation = phoneAutomation;
    this.config = {
      apiEndpoint: '',
      apiKey: '',
      clientId: '',
      enabled: false,
      autoSyncContacts: false,
      autoSyncMessages: false,
      campaignEnabled: false
    };
  }

  async initialize(): Promise<void> {
    log.info('🔗 Initializing CRM Integration Service...');
    
    await this.setupCRMTables();
    await this.loadConfig();
    
    if (this.config.campaignEnabled) {
      this.startCampaignProcessor();
    }

    log.info('✅ CRM Integration Service initialized');
  }

  /**
   * Get current CRM configuration
   */
  async getConfig(): Promise<CRMConfig> {
    return this.config;
  }

  /**
   * Get all CRM integrations
   */
  async getIntegrations(): Promise<any[]> {
    // For now return the current config as a single integration
    return [{
      id: 'primary-crm',
      crm_provider: 'Custom CRM',
      integration_name: 'Primary CRM Integration',
      api_endpoint: this.config.apiEndpoint,
      sync_enabled: this.config.enabled
    }];
  }

  /**
   * Create a new CRM integration
   */
  async createIntegration(integrationData: any): Promise<any> {
    // For now, just update the existing config
    await this.updateConfig({
      ...this.config,
      apiEndpoint: integrationData.api_endpoint,
      enabled: integrationData.sync_enabled
    });
    
    return {
      id: 'primary-crm',
      ...integrationData
    };
  }

  /**
   * Update an existing CRM integration
   */
  async updateIntegration(integrationId: string, updateData: any): Promise<any> {
    // For now, just update the existing config
    await this.updateConfig({
      ...this.config,
      apiEndpoint: updateData.api_endpoint,
      enabled: updateData.sync_enabled
    });
    
    return {
      id: integrationId,
      ...updateData
    };
  }

  private async setupCRMTables(): Promise<void> {
    try {
      // CRM Configuration table
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS crm_config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Campaign table
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS campaigns (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          message_template TEXT NOT NULL,
          contact_filter TEXT,
          scheduled_start DATETIME,
          status TEXT CHECK(status IN ('draft', 'scheduled', 'running', 'completed', 'paused')) DEFAULT 'draft',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Campaign Messages table
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS campaign_messages (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          contact_id TEXT NOT NULL,
          phone_number TEXT NOT NULL,
          message TEXT NOT NULL,
          scheduled_time DATETIME NOT NULL,
          sent_time DATETIME,
          status TEXT CHECK(status IN ('scheduled', 'sent', 'failed', 'cancelled')) DEFAULT 'scheduled',
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns (id),
          FOREIGN KEY (contact_id) REFERENCES contacts (id)
        )
      `);

      // CRM Sync History table
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS crm_sync_history (
          id TEXT PRIMARY KEY,
          sync_type TEXT NOT NULL, -- 'contacts', 'messages', 'campaigns'
          direction TEXT NOT NULL, -- 'to_crm', 'from_crm'
          records_processed INTEGER DEFAULT 0,
          records_success INTEGER DEFAULT 0,
          records_failed INTEGER DEFAULT 0,
          sync_started DATETIME DEFAULT CURRENT_TIMESTAMP,
          sync_completed DATETIME,
          error_log TEXT
        )
      `);

      log.info('📊 CRM tables setup completed');
    } catch (error) {
      log.error('❌ Failed to setup CRM tables:', error);
      throw error;
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configRows = await this.databaseManager.query('SELECT key, value FROM crm_config');
      
      for (const row of configRows) {
        switch (row.key) {
          case 'api_endpoint':
            this.config.apiEndpoint = row.value;
            break;
          case 'api_key':
            this.config.apiKey = row.value;
            break;
          case 'client_id':
            this.config.clientId = row.value;
            break;
          case 'enabled':
            this.config.enabled = row.value === 'true';
            break;
          case 'auto_sync_contacts':
            this.config.autoSyncContacts = row.value === 'true';
            break;
          case 'auto_sync_messages':
            this.config.autoSyncMessages = row.value === 'true';
            break;
          case 'campaign_enabled':
            this.config.campaignEnabled = row.value === 'true';
            break;
        }
      }

      log.info(`🔗 CRM config loaded - Enabled: ${this.config.enabled}, Campaigns: ${this.config.campaignEnabled}`);
    } catch (error) {
      log.error('❌ Failed to load CRM config:', error);
    }
  }

  async updateConfig(newConfig: Partial<CRMConfig>): Promise<void> {
    try {
      for (const [key, value] of Object.entries(newConfig)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        await this.databaseManager.run(
          'INSERT OR REPLACE INTO crm_config (key, value) VALUES (?, ?)',
          [dbKey, String(value)]
        );
        
        // Update local config
        (this.config as any)[key] = value;
      }

      log.info('🔗 CRM config updated');
      this.emit('config-updated', this.config);

      // Restart campaign processor if needed
      if (this.config.campaignEnabled && !this.campaignInterval) {
        this.startCampaignProcessor();
      } else if (!this.config.campaignEnabled && this.campaignInterval) {
        this.stopCampaignProcessor();
      }
    } catch (error) {
      log.error('❌ Failed to update CRM config:', error);
      throw error;
    }
  }

  /**
   * Create a new text campaign
   */
  async createCampaign(
    name: string,
    description: string,
    messageTemplate: string,
    contactFilter: string = '',
    scheduledStart?: Date
  ): Promise<string> {
    const campaignId = crypto.randomUUID();
    
    try {
      await this.databaseManager.run(`
        INSERT INTO campaigns (id, name, description, message_template, contact_filter, scheduled_start)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        campaignId,
        name,
        description,
        messageTemplate,
        contactFilter,
        scheduledStart?.toISOString() || null
      ]);

      log.info(`📢 Campaign created: ${name} (${campaignId})`);
      this.emit('campaign-created', { campaignId, name });
      
      return campaignId;
    } catch (error) {
      log.error('❌ Failed to create campaign:', error);
      throw error;
    }
  }

  /**
   * Start a campaign - schedules messages for contacts matching the filter
   */
  async startCampaign(campaignId: string): Promise<void> {
    try {
      const campaigns = await this.databaseManager.query(
        'SELECT * FROM campaigns WHERE id = ?',
        [campaignId]
      );

      if (campaigns.length === 0) {
        throw new Error('Campaign not found');
      }

      const campaign = campaigns[0];
      
      // Get contacts matching the filter
      let contactQuery = 'SELECT * FROM contacts';
      const params: any[] = [];
      
      if (campaign.contact_filter) {
        contactQuery += ' WHERE ' + campaign.contact_filter;
      }

      const contacts = await this.databaseManager.query(contactQuery, params);

      log.info(`📢 Starting campaign "${campaign.name}" for ${contacts.length} contacts`);

      // Schedule messages for each contact
      for (const contact of contacts) {
        const messageId = crypto.randomUUID();
        const phoneNumbers = JSON.parse(contact.phone_numbers || '[]');
        
        if (phoneNumbers.length === 0) {
          log.warn(`⚠️ No phone numbers for contact ${contact.display_name}`);
          continue;
        }

        const primaryPhone = phoneNumbers[0];
        const personalizedMessage = this.personalizeMessage(
          campaign.message_template, 
          contact
        );

        await this.databaseManager.run(`
          INSERT INTO campaign_messages (id, campaign_id, contact_id, phone_number, message, scheduled_time)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          messageId,
          campaignId,
          contact.id,
          primaryPhone,
          personalizedMessage,
          new Date().toISOString()
        ]);
      }

      // Update campaign status
      await this.databaseManager.run(
        'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?',
        ['running', new Date().toISOString(), campaignId]
      );

      log.info(`📢 Campaign "${campaign.name}" started with ${contacts.length} scheduled messages`);
      this.emit('campaign-started', { campaignId, messageCount: contacts.length });

    } catch (error) {
      log.error('❌ Failed to start campaign:', error);
      throw error;
    }
  }

  private personalizeMessage(template: string, contact: any): string {
    let personalized = template;
    
    // Replace common placeholders
    personalized = personalized.replace(/\{first_name\}/g, contact.first_name || 'there');
    personalized = personalized.replace(/\{last_name\}/g, contact.last_name || '');
    personalized = personalized.replace(/\{full_name\}/g, contact.display_name || 'there');
    
    return personalized;
  }

  private startCampaignProcessor(): void {
    if (this.campaignInterval) {
      clearInterval(this.campaignInterval);
    }

    log.info('📢 Starting campaign message processor...');
    
    this.campaignInterval = setInterval(async () => {
      await this.processPendingCampaignMessages();
    }, 30000); // Process every 30 seconds
  }

  private stopCampaignProcessor(): void {
    if (this.campaignInterval) {
      clearInterval(this.campaignInterval);
      this.campaignInterval = null;
      log.info('📢 Campaign processor stopped');
    }
  }

  private async processPendingCampaignMessages(): Promise<void> {
    try {
      // Get pending messages that are ready to send
      const pendingMessages = await this.databaseManager.query(`
        SELECT cm.*, c.display_name as contact_name
        FROM campaign_messages cm
        LEFT JOIN contacts c ON cm.contact_id = c.id
        WHERE cm.status = 'scheduled' 
        AND cm.scheduled_time <= datetime('now')
        ORDER BY cm.scheduled_time ASC
        LIMIT 5
      `);

      for (const message of pendingMessages) {
        try {
          log.info(`📱 Sending campaign message to ${message.contact_name} (${message.phone_number})`);
          
          // Send via Phone Link automation
          const success = await this.phoneAutomation.sendMessageThroughPhoneLink(
            message.phone_number,
            message.message
          );

          if (success) {
            await this.databaseManager.run(
              'UPDATE campaign_messages SET status = ?, sent_time = ? WHERE id = ?',
              ['sent', new Date().toISOString(), message.id]
            );
            log.info(`✅ Campaign message sent to ${message.contact_name}`);
            this.emit('campaign-message-sent', { messageId: message.id, contactName: message.contact_name });
          } else {
            await this.databaseManager.run(
              'UPDATE campaign_messages SET status = ?, error_message = ? WHERE id = ?',
              ['failed', 'Phone Link automation failed', message.id]
            );
            log.error(`❌ Failed to send campaign message to ${message.contact_name}`);
          }

          // Add delay between messages to avoid spam
          await new Promise(resolve => setTimeout(resolve, 5000));

        } catch (error) {
          log.error(`❌ Error sending campaign message ${message.id}:`, error);
          await this.databaseManager.run(
            'UPDATE campaign_messages SET status = ?, error_message = ? WHERE id = ?',
            ['failed', String(error), message.id]
          );
        }
      }

    } catch (error) {
      log.error('❌ Error processing campaign messages:', error);
    }
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(): Promise<Campaign[]> {
    const campaigns = await this.databaseManager.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    return campaigns.map(c => ({
      ...c,
      scheduledStart: c.scheduled_start ? new Date(c.scheduled_start) : null,
      createdAt: new Date(c.created_at),
      updatedAt: new Date(c.updated_at)
    }));
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<any> {
    const stats = await this.databaseManager.query(`
      SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as pending_count
      FROM campaign_messages 
      WHERE campaign_id = ?
    `, [campaignId]);

    return stats[0] || { total_messages: 0, sent_count: 0, failed_count: 0, pending_count: 0 };
  }

  async cleanup(): Promise<void> {
    this.stopCampaignProcessor();
  }
}
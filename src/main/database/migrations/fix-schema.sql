-- Fix Schema Migration
-- Add missing columns to existing tables

-- Add missing columns to sync_history table
ALTER TABLE sync_history ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT 1;

-- Add missing columns to file_transfers table  
ALTER TABLE file_transfers ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT 0;

-- Add missing columns to backup_history table
ALTER TABLE backup_history ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sync_history_completed ON sync_history(completed);
CREATE INDEX IF NOT EXISTS idx_file_transfers_completed ON file_transfers(completed);
CREATE INDEX IF NOT EXISTS idx_backup_history_completed ON backup_history(completed);

-- Ensure sync_history has proper structure
CREATE TABLE IF NOT EXISTS sync_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed BOOLEAN DEFAULT 1,
  error_message TEXT,
  items_synced INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0
);

-- Ensure file_transfers has proper structure
CREATE TABLE IF NOT EXISTS file_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  transfer_type TEXT NOT NULL, -- 'upload' or 'download'
  status TEXT NOT NULL DEFAULT 'pending',
  progress REAL DEFAULT 0,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed BOOLEAN DEFAULT 0,
  error_message TEXT
);

-- Ensure backup_history has proper structure  
CREATE TABLE IF NOT EXISTS backup_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed BOOLEAN DEFAULT 0,
  error_message TEXT
);

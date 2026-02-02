-- =============================================================================
-- SQL Migration: Add Email Column to warehouse_managers Table
-- Purpose: Store warehouse manager email for notification system
-- Date: December 26, 2024
-- Run this in pgAdmin to add email field to warehouse_managers table
-- =============================================================================

-- Add email column to warehouse_managers table (nullable for optional field)
ALTER TABLE warehouse_managers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add comment to column for documentation
COMMENT ON COLUMN warehouse_managers.email IS 'Manager email for receiving warehouse-specific notifications and alerts';

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_email 
ON warehouse_managers(email);

-- =============================================================================
-- Verification Queries (Run these to confirm changes)
-- =============================================================================

-- Check if email column was added successfully
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'warehouse_managers' 
  AND column_name = 'email';

-- Check if index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'warehouse_managers' 
  AND indexname = 'idx_warehouse_managers_email';

-- View updated table structure
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'warehouse_managers'
ORDER BY ordinal_position;

-- Count warehouse managers with and without email
SELECT 
  COUNT(*) as total_managers,
  COUNT(email) as managers_with_email,
  COUNT(*) - COUNT(email) as managers_without_email
FROM warehouse_managers;

-- =============================================================================
-- Success Message
-- =============================================================================
-- If all queries above run successfully, the migration is complete!
-- The email column is now available for warehouse manager notifications.
-- =============================================================================

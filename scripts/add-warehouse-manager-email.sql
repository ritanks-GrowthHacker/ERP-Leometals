-- SQL Migration Script for Warehouse Manager Email and Notification System
-- Run this in pgAdmin
-- Date: December 31, 2025

-- Step 1: Add manager_email column to warehouses table (nullable)
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS manager_email VARCHAR(255);

-- Step 2: Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_warehouses_manager_email 
ON warehouses(manager_email) 
WHERE manager_email IS NOT NULL;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN warehouses.manager_email IS 'Optional email address of warehouse manager for receiving notifications';

-- Verification query - Check the new column
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'warehouses' 
  AND column_name = 'manager_email';

-- Sample query to see current warehouses with new column
SELECT 
    id,
    name,
    code,
    email as warehouse_email,
    manager_email,
    is_active
FROM warehouses
ORDER BY name;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Added manager_email column to warehouses table';
    RAISE NOTICE 'Column is nullable - existing records are unaffected';
END $$;

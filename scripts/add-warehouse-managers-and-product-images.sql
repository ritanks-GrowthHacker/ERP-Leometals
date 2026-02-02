-- Migration: Add Warehouse Manager Details and Product Image URL
-- Run this in pgAdmin on your ERP database

-- ============================================
-- 1. CREATE WAREHOUSE MANAGERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS warehouse_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  mobile_number VARCHAR(20),
  gender VARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(warehouse_id)
);

-- Create index for faster lookups
CREATE INDEX idx_warehouse_managers_warehouse_id ON warehouse_managers(warehouse_id);

-- ============================================
-- 2. ADD IMAGE_URL TO PRODUCTS TABLE (if not exists)
-- ============================================

-- Check if column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE products ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- ============================================
-- 3. CREATE UPDATED_AT TRIGGER FOR WAREHOUSE_MANAGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_warehouse_managers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_warehouse_managers_updated_at ON warehouse_managers;
CREATE TRIGGER trigger_warehouse_managers_updated_at
  BEFORE UPDATE ON warehouse_managers
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_managers_updated_at();

-- ============================================
-- 4. VERIFICATION QUERIES
-- ============================================

-- Verify warehouse_managers table
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'warehouse_managers'
ORDER BY ordinal_position;

-- Verify image_url column in products
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'image_url';

-- Check existing data
SELECT 
  w.id,
  w.name as warehouse_name,
  wm.name as manager_name,
  wm.mobile_number,
  wm.gender
FROM warehouses w
LEFT JOIN warehouse_managers wm ON w.id = wm.warehouse_id
ORDER BY w.created_at DESC
LIMIT 10;

-- Success message
SELECT 'Migration completed successfully! Warehouse managers table created and products.image_url added.' as status;

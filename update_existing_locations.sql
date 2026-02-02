-- Update Existing Warehouse Locations with Location Types
-- Run this script to fix locations that were created before the location type feature was added

-- First, let's see what locations need updating
SELECT 
    id,
    name,
    code,
    location_type,
    warehouse_id
FROM warehouse_locations
WHERE location_type IS NULL OR location_type = '';

-- Update JP Nagar to Zone type
UPDATE warehouse_locations 
SET location_type = 'zone',
    updated_at = NOW()
WHERE code = '11900_12' 
  AND location_type IS NULL;

-- Update Arekere to Zone type  
UPDATE warehouse_locations 
SET location_type = 'zone',
    updated_at = NOW()
WHERE code = '56789_111'
  AND location_type IS NULL;

-- Update bomanhalli to Zone type
UPDATE warehouse_locations 
SET location_type = 'zone',
    updated_at = NOW()
WHERE code = 'bom_098'
  AND location_type IS NULL;

-- Optional: Add manager details to locations
-- Uncomment and modify these if you want to add manager information

-- UPDATE warehouse_locations 
-- SET 
--     manager_name = 'Manager Name',
--     manager_email = 'manager@example.com',
--     manager_mobile = '+919876543210',
--     manager_gender = 'Male',
--     updated_at = NOW()
-- WHERE code = '11900_12';

-- UPDATE warehouse_locations 
-- SET 
--     manager_name = 'Manager Name',
--     manager_email = 'manager@example.com',
--     manager_mobile = '+919876543210',
--     manager_gender = 'Female',
--     updated_at = NOW()
-- WHERE code = '56789_111';

-- UPDATE warehouse_locations 
-- SET 
--     manager_name = 'Manager Name',
--     manager_email = 'manager@example.com',
--     manager_mobile = '+919876543210',
--     manager_gender = 'Other',
--     updated_at = NOW()
-- WHERE code = 'bom_098';

-- Verify the updates
SELECT 
    code,
    name,
    location_type,
    manager_name,
    manager_email,
    manager_mobile,
    manager_gender
FROM warehouse_locations
ORDER BY created_at DESC;

-- If you want to update ALL locations at once to a default type:
-- UPDATE warehouse_locations 
-- SET location_type = 'zone',
--     updated_at = NOW()
-- WHERE location_type IS NULL;

-- ============================================
-- REVERT RBAC IMPLEMENTATION CHANGES
-- ============================================

-- Drop the warehouse_manager_otp table
DROP TABLE IF EXISTS warehouse_manager_otp CASCADE;

-- Remove manager_type column from warehouse_managers
ALTER TABLE warehouse_managers 
DROP COLUMN IF EXISTS manager_type;

-- Remove manager_type column from warehouse_locations
ALTER TABLE warehouse_locations 
DROP COLUMN IF EXISTS manager_type;

-- Note: Keeping warehouse_id and warehouse_location_id in erp_user_access as they might be useful
-- If you want to remove them too, uncomment below:
-- ALTER TABLE erp_user_access DROP COLUMN IF EXISTS warehouse_id;
-- ALTER TABLE erp_user_access DROP COLUMN IF EXISTS warehouse_location_id;

-- Success message
SELECT 'RBAC changes reverted successfully. warehouse_manager_otp table dropped, manager_type columns removed.' AS status;

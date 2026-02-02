-- Add location manager fields to warehouse_locations table
-- This allows tracking location managers for each warehouse location

ALTER TABLE warehouse_locations 
ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS manager_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS manager_mobile VARCHAR(50),
ADD COLUMN IF NOT EXISTS manager_gender VARCHAR(50);

-- Add bin and rack tracking to stock_levels table for precise location management
ALTER TABLE stock_levels
ADD COLUMN IF NOT EXISTS bin_position VARCHAR(50),
ADD COLUMN IF NOT EXISTS rack_number VARCHAR(50);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_manager_email 
ON warehouse_locations(manager_email);

CREATE INDEX IF NOT EXISTS idx_stock_levels_bin_position
ON stock_levels(bin_position);

CREATE INDEX IF NOT EXISTS idx_stock_levels_rack_number
ON stock_levels(rack_number);

-- Add comments
COMMENT ON COLUMN warehouse_locations.manager_name IS 'Name of the location manager responsible for this warehouse location';
COMMENT ON COLUMN warehouse_locations.manager_email IS 'Email address of the location manager';
COMMENT ON COLUMN warehouse_locations.manager_mobile IS 'Mobile number of the location manager';
COMMENT ON COLUMN warehouse_locations.manager_gender IS 'Gender of the location manager (Male, Female, Other, Prefer not to say)';

COMMENT ON COLUMN stock_levels.bin_position IS 'Specific bin position within the location (e.g., A1, B3, C2)';
COMMENT ON COLUMN stock_levels.rack_number IS 'Rack number within the location for rack-type warehouses';

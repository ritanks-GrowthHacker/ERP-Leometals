-- Add address field to warehouse_locations table
ALTER TABLE warehouse_locations 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comment to the column
COMMENT ON COLUMN warehouse_locations.address IS 'Physical address of the warehouse location';

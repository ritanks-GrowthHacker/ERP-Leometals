-- Add warehouse_location_id column to sales_order_lines table
-- This allows tracking which specific warehouse location each line item should be fulfilled from

ALTER TABLE sales_order_lines 
ADD COLUMN IF NOT EXISTS warehouse_location_id UUID REFERENCES warehouse_locations(id) ON DELETE RESTRICT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_warehouse_location 
ON sales_order_lines(warehouse_location_id);

COMMENT ON COLUMN sales_order_lines.warehouse_location_id IS 'The specific warehouse location from which this line item should be fulfilled';

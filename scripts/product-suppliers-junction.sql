-- First check what columns exist in the table
-- Run this query first to see the actual column names:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'product_suppliers';

-- If table exists, just add indexes (adjust column names based on query above)
-- Try with snake_case first:
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_is_primary ON product_suppliers(is_primary) WHERE is_primary = TRUE;

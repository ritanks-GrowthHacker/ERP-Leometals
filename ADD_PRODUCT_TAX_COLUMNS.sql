-- Add new columns to products table for tax and measurement attributes

-- Add measurement columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(50); -- 'weight_g', 'volume_ml', 'length_m'
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_weight DECIMAL(15, 3); -- weight of one unit in grams

-- Add tax identity columns (NOT tax amounts)
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(20); -- HSN/SAC code
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_category VARCHAR(50); -- 'taxable', 'exempt', 'nil_rated', 'rcm_applicable'
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_gst_rate DECIMAL(5, 2); -- Default GST rate (e.g., 5.00, 12.00, 18.00, 28.00)

-- Add default tax IDs (will reference tax master tables when created)
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_purchase_tax_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_sales_tax_id UUID;

-- Add comments for clarity
COMMENT ON COLUMN products.unit_of_measure IS 'Unit of measure type: weight_g, volume_ml, length_m';
COMMENT ON COLUMN products.unit_weight IS 'Weight of one unit in grams';
COMMENT ON COLUMN products.hsn_sac_code IS 'HSN code for goods or SAC code for services';
COMMENT ON COLUMN products.tax_category IS 'Tax category: taxable, exempt, nil_rated, rcm_applicable';
COMMENT ON COLUMN products.default_gst_rate IS 'Default GST rate percentage (5, 12, 18, 28)';
COMMENT ON COLUMN products.default_purchase_tax_id IS 'Reference to default tax for purchases';
COMMENT ON COLUMN products.default_sales_tax_id IS 'Reference to default tax for sales';

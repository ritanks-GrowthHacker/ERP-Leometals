-- Check if columns already exist in products table
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN (
    'unit_of_measure',
    'unit_weight', 
    'hsn_sac_code',
    'tax_category',
    'default_gst_rate',
    'default_purchase_tax_id',
    'default_sales_tax_id'
)
ORDER BY column_name;

-- If the above query returns 0 rows, run the ADD_PRODUCT_TAX_COLUMNS.sql file
-- If it returns rows, the columns already exist and you don't need to run the migration

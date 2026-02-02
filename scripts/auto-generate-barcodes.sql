-- Migration: Auto-generate barcodes for products
-- This SQL script generates barcodes for all products that don't have one
-- Barcode format: {ProductName}-{SKU}-{WarehouseCode}

-- First, let's create a function to generate clean barcode strings
CREATE OR REPLACE FUNCTION generate_product_barcode(
  p_name TEXT,
  p_sku TEXT,
  p_warehouse_code TEXT DEFAULT 'WH00'
) RETURNS TEXT AS $$
BEGIN
  -- Clean product name: remove special chars, take first 20 chars, uppercase
  RETURN CONCAT(
    UPPER(REGEXP_REPLACE(SUBSTRING(p_name, 1, 20), '[^a-zA-Z0-9]', '', 'g')),
    '-',
    UPPER(p_sku),
    '-',
    UPPER(p_warehouse_code)
  );
END;
$$ LANGUAGE plpgsql;

-- Update products table with auto-generated barcodes where barcode is NULL or empty
UPDATE products p
SET barcode = generate_product_barcode(
  p.name,
  p.sku,
  COALESCE(
    (SELECT w.code 
     FROM warehouses w 
     JOIN stock_levels sl ON sl.warehouse_id = w.id 
     WHERE sl.product_id = p.id 
     ORDER BY sl.quantity_on_hand DESC 
     LIMIT 1
    ),
    'WH00'
  )
)
WHERE p.barcode IS NULL OR p.barcode = '';

-- Alternative: If you want to regenerate ALL barcodes (uncomment to use)
-- UPDATE products p
-- SET barcode = generate_product_barcode(
--   p.name,
--   p.sku,
--   COALESCE(
--     (SELECT w.code 
--      FROM warehouses w 
--      JOIN stock_levels sl ON sl.warehouse_id = w.id 
--      WHERE sl.product_id = p.id 
--      ORDER BY sl.quantity_on_hand DESC 
--      LIMIT 1
--     ),
--     'WH00'
--   )
-- );

-- Create a trigger to auto-generate barcode on INSERT
CREATE OR REPLACE FUNCTION trigger_auto_generate_barcode()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := generate_product_barcode(
      NEW.name,
      NEW.sku,
      'WH00' -- Default warehouse code, will be updated when stock is added
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS auto_generate_product_barcode ON products;
CREATE TRIGGER auto_generate_product_barcode
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_generate_barcode();

-- Verification query - Check generated barcodes
SELECT 
  id,
  name,
  sku,
  barcode,
  (SELECT w.code 
   FROM warehouses w 
   JOIN stock_levels sl ON sl.warehouse_id = w.id 
   WHERE sl.product_id = p.id 
   ORDER BY sl.quantity_on_hand DESC 
   LIMIT 1
  ) as primary_warehouse
FROM products p
ORDER BY created_at DESC
LIMIT 20;

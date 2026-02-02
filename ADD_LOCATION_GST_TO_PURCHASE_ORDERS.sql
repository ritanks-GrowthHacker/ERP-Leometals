-- ============================================
-- ADD WAREHOUSE LOCATION AND GST TO PURCHASE ORDERS
-- ============================================
-- This SQL adds warehouse location support and complete GST implementation
-- to the purchasing module for proper finance module integration

-- 1. Add location_id to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES warehouse_locations(id) ON DELETE RESTRICT;

-- Add index for location lookups
CREATE INDEX IF NOT EXISTS idx_purchase_orders_location_id ON purchase_orders(location_id);

-- Add comment
COMMENT ON COLUMN purchase_orders.location_id IS 'Specific warehouse location where goods will be delivered';

-- 2. Add GST fields to purchase_orders table
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15),
ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100);

-- Add comments for GST fields
COMMENT ON COLUMN purchase_orders.cgst_amount IS 'Central GST amount (for intra-state transactions)';
COMMENT ON COLUMN purchase_orders.sgst_amount IS 'State GST amount (for intra-state transactions)';
COMMENT ON COLUMN purchase_orders.igst_amount IS 'Integrated GST amount (for inter-state transactions)';
COMMENT ON COLUMN purchase_orders.gst_number IS 'Supplier GST number';
COMMENT ON COLUMN purchase_orders.place_of_supply IS 'Place of supply for GST calculation';

-- 3. Add GST fields to purchase_order_lines table
ALTER TABLE purchase_order_lines
ADD COLUMN IF NOT EXISTS cgst_rate DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_rate DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_rate DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);

-- Add comments for line-level GST fields
COMMENT ON COLUMN purchase_order_lines.cgst_rate IS 'CGST rate percentage for this line item';
COMMENT ON COLUMN purchase_order_lines.sgst_rate IS 'SGST rate percentage for this line item';
COMMENT ON COLUMN purchase_order_lines.igst_rate IS 'IGST rate percentage for this line item';
COMMENT ON COLUMN purchase_order_lines.cgst_amount IS 'CGST amount for this line item';
COMMENT ON COLUMN purchase_order_lines.sgst_amount IS 'SGST amount for this line item';
COMMENT ON COLUMN purchase_order_lines.igst_amount IS 'IGST amount for this line item';
COMMENT ON COLUMN purchase_order_lines.hsn_code IS 'HSN (Harmonized System of Nomenclature) code for GST';

-- 4. Add GST fields to suppliers table
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15),
ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10),
ADD COLUMN IF NOT EXISTS gst_state VARCHAR(100);

-- Add index for GST number lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_gst_number ON suppliers(gst_number);

-- Add comments
COMMENT ON COLUMN suppliers.gst_number IS 'Supplier GST identification number';
COMMENT ON COLUMN suppliers.pan_number IS 'Supplier PAN (Permanent Account Number)';
COMMENT ON COLUMN suppliers.gst_state IS 'State where supplier is registered for GST';

-- 5. Add HSN code to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5, 2) DEFAULT 18;

-- Add index
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON products(hsn_code);

-- Add comments
COMMENT ON COLUMN products.hsn_code IS 'HSN code for GST classification';
COMMENT ON COLUMN products.gst_rate IS 'Default GST rate for this product';

-- 6. Update purchase receipts to include location and GST
ALTER TABLE po_goods_receipts
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(15, 2) DEFAULT 0;

-- Add comments
COMMENT ON COLUMN po_goods_receipts.location_id IS 'Warehouse location where goods were received';
COMMENT ON COLUMN po_goods_receipts.cgst_amount IS 'CGST amount for this receipt';
COMMENT ON COLUMN po_goods_receipts.sgst_amount IS 'SGST amount for this receipt';
COMMENT ON COLUMN po_goods_receipts.igst_amount IS 'IGST amount for this receipt';

-- 7. Update supplier invoices to include GST details
ALTER TABLE supplier_invoices
ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15),
ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100);

-- Add comments
COMMENT ON COLUMN supplier_invoices.cgst_amount IS 'CGST amount on invoice';
COMMENT ON COLUMN supplier_invoices.sgst_amount IS 'SGST amount on invoice';
COMMENT ON COLUMN supplier_invoices.igst_amount IS 'IGST amount on invoice';
COMMENT ON COLUMN supplier_invoices.gst_number IS 'Supplier GST number on invoice';
COMMENT ON COLUMN supplier_invoices.place_of_supply IS 'Place of supply mentioned on invoice';

-- 8. Create function to calculate GST based on state
CREATE OR REPLACE FUNCTION calculate_gst_type(
  buyer_state VARCHAR(100),
  seller_state VARCHAR(100),
  base_amount DECIMAL(15, 2),
  gst_rate DECIMAL(5, 2),
  OUT cgst_amount DECIMAL(15, 2),
  OUT sgst_amount DECIMAL(15, 2),
  OUT igst_amount DECIMAL(15, 2)
) AS $$
BEGIN
  -- If same state: CGST + SGST (split equally)
  IF UPPER(buyer_state) = UPPER(seller_state) THEN
    cgst_amount := ROUND((base_amount * gst_rate / 100) / 2, 2);
    sgst_amount := ROUND((base_amount * gst_rate / 100) / 2, 2);
    igst_amount := 0;
  -- If different states: IGST
  ELSE
    cgst_amount := 0;
    sgst_amount := 0;
    igst_amount := ROUND(base_amount * gst_rate / 100, 2);
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_gst_type IS 'Calculates CGST, SGST, or IGST based on buyer and seller states';

-- 9. Update tax_amount to be sum of all GST components (for existing records)
UPDATE purchase_orders
SET tax_amount = COALESCE(cgst_amount, 0) + COALESCE(sgst_amount, 0) + COALESCE(igst_amount, 0)
WHERE cgst_amount IS NOT NULL OR sgst_amount IS NOT NULL OR igst_amount IS NOT NULL;

-- 10. Add state information to warehouses if not exists
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS state VARCHAR(100);

COMMENT ON COLUMN warehouses.state IS 'State where warehouse is located (for GST calculation)';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if columns were added successfully
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
  AND column_name IN ('location_id', 'cgst_amount', 'sgst_amount', 'igst_amount', 'gst_number', 'place_of_supply')
ORDER BY ordinal_position;

-- Check purchase_order_lines GST columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_order_lines'
  AND column_name LIKE '%gst%' OR column_name = 'hsn_code'
ORDER BY ordinal_position;

-- Check suppliers GST columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'suppliers'
  AND column_name IN ('gst_number', 'pan_number', 'gst_state')
ORDER BY ordinal_position;

-- Check products HSN columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('hsn_code', 'gst_rate')
ORDER BY ordinal_position;

-- Test GST calculation function
SELECT * FROM calculate_gst_type('Maharashtra', 'Maharashtra', 10000, 18);  -- Should return CGST=900, SGST=900, IGST=0
SELECT * FROM calculate_gst_type('Maharashtra', 'Karnataka', 10000, 18);   -- Should return CGST=0, SGST=0, IGST=1800

PRINT 'Location and GST fields added successfully to purchasing module!';

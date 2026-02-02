-- Add warehouse and location tracking to supplier invoices
-- This allows tracking which warehouse/location the invoice is related to

ALTER TABLE supplier_invoices
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_warehouse_id ON supplier_invoices(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_location_id ON supplier_invoices(location_id);

-- Add comments
COMMENT ON COLUMN supplier_invoices.warehouse_id IS 'Warehouse where goods will be/were received';
COMMENT ON COLUMN supplier_invoices.location_id IS 'Specific location within warehouse for goods';

-- Update existing invoices to link warehouse/location from purchase_orders
-- Link through quotation -> PO
UPDATE supplier_invoices
SET 
  warehouse_id = po.warehouse_id,
  location_id = po.location_id
FROM purchase_orders po
WHERE supplier_invoices.purchase_order_id = po.id
  AND supplier_invoices.warehouse_id IS NULL
  AND po.warehouse_id IS NOT NULL;


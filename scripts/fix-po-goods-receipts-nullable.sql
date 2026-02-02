-- Fix PO Goods Receipts to allow NULL warehouse and supplier for draft POs
-- This allows generating receipts from draft POs without warehouse/supplier assigned

-- Make warehouse_id and supplier_id nullable
ALTER TABLE po_goods_receipts 
  ALTER COLUMN warehouse_id DROP NOT NULL,
  ALTER COLUMN supplier_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN po_goods_receipts.warehouse_id IS 'Warehouse for receipt. Can be NULL for draft PO receipts, must be set before receiving goods';
COMMENT ON COLUMN po_goods_receipts.supplier_id IS 'Supplier for receipt. Can be NULL for draft PO receipts, must be set before sending to supplier';

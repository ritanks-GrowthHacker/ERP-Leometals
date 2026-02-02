-- Migration: Make supplier_id and warehouse_id nullable in purchase_orders
-- Date: 2025-12-26
-- Description: Allow creating draft purchase orders without supplier and warehouse

-- Make supplier_id nullable
ALTER TABLE purchase_orders 
ALTER COLUMN supplier_id DROP NOT NULL;

-- Make warehouse_id nullable
ALTER TABLE purchase_orders 
ALTER COLUMN warehouse_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN purchase_orders.supplier_id IS 'Can be null for draft purchase orders created from MRP';
COMMENT ON COLUMN purchase_orders.warehouse_id IS 'Can be null for draft purchase orders, added later during PO completion';

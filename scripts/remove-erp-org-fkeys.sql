-- Migration to make ERP work without erp_organizations table
-- This removes the foreign key dependency

-- Step 1: Drop foreign key constraints that reference erp_organizations
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_erp_organization_id_fkey;
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_erp_organization_id_fkey;
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_erp_organization_id_fkey;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_erp_organization_id_fkey;
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_erp_organization_id_fkey;
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_erp_organization_id_fkey;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_erp_organization_id_fkey;
ALTER TABLE stock_adjustments DROP CONSTRAINT IF EXISTS stock_adjustments_erp_organization_id_fkey;
ALTER TABLE manufacturing_orders DROP CONSTRAINT IF EXISTS manufacturing_orders_erp_organization_id_fkey;
ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS product_categories_erp_organization_id_fkey;
ALTER TABLE units_of_measure DROP CONSTRAINT IF EXISTS units_of_measure_erp_organization_id_fkey;
ALTER TABLE bom_headers DROP CONSTRAINT IF EXISTS bom_headers_erp_organization_id_fkey;
ALTER TABLE erp_activity_logs DROP CONSTRAINT IF EXISTS erp_activity_logs_erp_organization_id_fkey;
ALTER TABLE vendor_invoices DROP CONSTRAINT IF EXISTS vendor_invoices_erp_organization_id_fkey;
ALTER TABLE request_for_quotations DROP CONSTRAINT IF EXISTS request_for_quotations_erp_organization_id_fkey;
ALTER TABLE supplier_quotations DROP CONSTRAINT IF EXISTS supplier_quotations_erp_organization_id_fkey;

-- Step 2: Comment explaining the change
COMMENT ON COLUMN products.erp_organization_id IS 'References main organizations table by UUID (not enforced by FK for flexibility)';
COMMENT ON COLUMN warehouses.erp_organization_id IS 'References main organizations table by UUID (not enforced by FK for flexibility)';
COMMENT ON COLUMN suppliers.erp_organization_id IS 'References main organizations table by UUID (not enforced by FK for flexibility)';
COMMENT ON COLUMN customers.erp_organization_id IS 'References main organizations table by UUID (not enforced by FK for flexibility)';
COMMENT ON COLUMN request_for_quotations.erp_organization_id IS 'References main organizations table by UUID (not enforced by FK for flexibility)';
COMMENT ON COLUMN supplier_quotations.erp_organization_id IS 'References main organizations table by UUID (not enforced by FK for flexibility)';

-- Note: erp_organization_id now directly stores the organization_id from main database
-- This allows ERP to work independently without erp_organizations mapping table

-- ============================================
-- COMPLETE SALES MODULE SCHEMA UPDATES
-- ============================================
-- Run this script to add all missing columns and features for sales module

-- Add delivery_date column to sales_orders
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Add updatedBy column to sales_orders
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add delivery_status to track delivery progress
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'pending';

-- Create index on delivery_date
CREATE INDEX IF NOT EXISTS idx_sales_orders_delivery_date ON sales_orders(delivery_date);

-- Create index on delivery_status
CREATE INDEX IF NOT EXISTS idx_sales_orders_delivery_status ON sales_orders(delivery_status);

-- Update sales_order_lines to track delivered quantities
ALTER TABLE sales_order_lines 
ADD COLUMN IF NOT EXISTS quantity_delivered DECIMAL(15,2) DEFAULT 0;

-- ============================================
-- CUSTOMER ADDRESSES & CONTACTS
-- ============================================

-- Customer addresses table (for multiple shipping/billing addresses)
CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_type VARCHAR(20) NOT NULL, -- 'billing', 'shipping', 'both'
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_type ON customer_addresses(address_type);

-- Customer contacts table (for multiple contact persons)
CREATE TABLE IF NOT EXISTS customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id);

-- ============================================
-- SALES HISTORY TABLE ENHANCEMENTS
-- ============================================

-- Ensure sales_history table has all required columns
ALTER TABLE sales_history 
ADD COLUMN IF NOT EXISTS cost_of_goods_sold DECIMAL(15,2) DEFAULT 0;

ALTER TABLE sales_history 
ADD COLUMN IF NOT EXISTS number_of_orders INTEGER DEFAULT 0;

ALTER TABLE sales_history 
ADD COLUMN IF NOT EXISTS average_order_quantity DECIMAL(15,2);

-- Create composite index for better performance
CREATE INDEX IF NOT EXISTS idx_sales_history_composite 
ON sales_history(product_id, warehouse_id, period_start, period_end);

-- ============================================
-- PURCHASE ORDER SUGGESTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_order_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    suggested_quantity DECIMAL(15,2) NOT NULL,
    current_stock DECIMAL(15,2),
    reorder_point DECIMAL(15,2),
    average_daily_consumption DECIMAL(15,2),
    days_of_stock_remaining INTEGER,
    estimated_stockout_date DATE,
    priority VARCHAR(20) DEFAULT 'normal', -- 'critical', 'high', 'normal', 'low'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'ordered'
    notes TEXT,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_suggestions_org ON purchase_order_suggestions(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_po_suggestions_product ON purchase_order_suggestions(product_id);
CREATE INDEX IF NOT EXISTS idx_po_suggestions_status ON purchase_order_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_po_suggestions_priority ON purchase_order_suggestions(priority);

-- ============================================
-- REORDER RULES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reorder_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    reorder_point DECIMAL(15,2) NOT NULL,
    reorder_quantity DECIMAL(15,2) NOT NULL,
    min_quantity DECIMAL(15,2),
    max_quantity DECIMAL(15,2),
    lead_time_days INTEGER DEFAULT 7,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_reorder_rules_org ON reorder_rules(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_reorder_rules_product ON reorder_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_reorder_rules_warehouse ON reorder_rules(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_reorder_rules_active ON reorder_rules(is_active);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant necessary permissions (adjust username as needed)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================
-- DATA VALIDATION & CLEANUP
-- ============================================

-- Update any existing sales orders without delivery status
UPDATE sales_orders 
SET delivery_status = 'pending' 
WHERE delivery_status IS NULL;

-- Update any existing sales orders with delivered status
UPDATE sales_orders 
SET delivery_status = 'delivered', 
    delivery_date = COALESCE(delivery_date, CURRENT_DATE)
WHERE status = 'delivered' AND delivery_date IS NULL;

-- ============================================
-- SCRIPT COMPLETE
-- ============================================
-- Run this script on your ERP database to add all missing features
-- After running, rebuild your app: npm run build

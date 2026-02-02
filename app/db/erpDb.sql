-- ERP Database Schema
-- This database works standalone but references users from the main database for authentication
-- Connection: Users authenticate via mainDb, then access ERP modules based on their organization/department

-- ============================================
-- CORE ERP TABLES
-- ============================================

-- Organizations table (references main db organizations)
CREATE TABLE erp_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_org_id UUID NOT NULL UNIQUE, -- References organizations(id) from mainDb
  erp_enabled BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  fiscal_year_start INTEGER DEFAULT 1, -- Month (1-12)
  currency_code VARCHAR(3) DEFAULT 'INR',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Departments (references main db departments)
CREATE TABLE erp_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_department_id UUID NOT NULL UNIQUE, -- References departments(id) from mainDb
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  can_manage_inventory BOOLEAN DEFAULT false,
  can_manage_purchases BOOLEAN DEFAULT false,
  can_manage_sales BOOLEAN DEFAULT false,
  can_manage_manufacturing BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User ERP Access (references users from mainDb)
CREATE TABLE erp_user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_user_id UUID NOT NULL, -- References users(id) from mainDb
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  erp_department_id UUID REFERENCES erp_departments(id) ON DELETE SET NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{}', -- Granular permissions
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(main_user_id, erp_organization_id)
);

-- ============================================
-- INVENTORY MANAGEMENT
-- ============================================

-- Warehouses
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),
  manager_user_id UUID, -- References users(id) from mainDb
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, code)
);

-- Warehouse Locations/Bins
CREATE TABLE warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  location_type VARCHAR(50) CHECK (location_type IN ('zone', 'aisle', 'rack', 'shelf', 'bin')),
  parent_location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  capacity DECIMAL(15,2),
  current_utilization DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

-- Product Categories
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  parent_category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, code)
);

-- Units of Measure
CREATE TABLE units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  uom_type VARCHAR(50) CHECK (uom_type IN ('unit', 'weight', 'volume', 'length', 'area', 'time')),
  is_base_unit BOOLEAN DEFAULT false,
  conversion_factor DECIMAL(15,6) DEFAULT 1.0, -- Relative to base unit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, code)
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  product_category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),
  description TEXT,
  product_type VARCHAR(50) NOT NULL CHECK (product_type IN ('storable', 'consumable', 'service')),
  tracking_type VARCHAR(50) DEFAULT 'none' CHECK (tracking_type IN ('none', 'serial', 'lot')),
  uom_id UUID REFERENCES units_of_measure(id),
  purchase_uom_id UUID REFERENCES units_of_measure(id),
  sale_uom_id UUID REFERENCES units_of_measure(id),
  cost_price DECIMAL(15,2) DEFAULT 0,
  sale_price DECIMAL(15,2) DEFAULT 0,
  weight DECIMAL(15,3),
  volume DECIMAL(15,3),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  reorder_point DECIMAL(15,2) DEFAULT 0,
  reorder_quantity DECIMAL(15,2) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID, -- References users(id) from mainDb
  updated_by UUID, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, sku)
);

-- Product Variants (for products with variations like size, color)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),
  attributes JSONB DEFAULT '{}', -- e.g., {"size": "L", "color": "Red"}
  cost_price DECIMAL(15,2),
  sale_price DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, sku)
);

-- Stock Levels
CREATE TABLE stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  quantity_on_hand DECIMAL(15,2) DEFAULT 0,
  quantity_reserved DECIMAL(15,2) DEFAULT 0,
  quantity_available DECIMAL(15,2) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  last_counted_at TIMESTAMP WITH TIME ZONE,
  last_counted_by UUID, -- References users(id) from mainDb
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, location_id, product_variant_id)
);

-- Serial Numbers & Lot Tracking
CREATE TABLE serial_lot_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  tracking_number VARCHAR(255) NOT NULL,
  tracking_type VARCHAR(50) CHECK (tracking_type IN ('serial', 'lot')),
  quantity DECIMAL(15,2) DEFAULT 1, -- Always 1 for serial numbers
  manufacture_date DATE,
  expiry_date DATE,
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold', 'damaged', 'expired')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, tracking_number)
);

-- ============================================
-- INVENTORY MOVEMENTS
-- ============================================

-- Stock Movements
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('receipt', 'delivery', 'internal_transfer', 'adjustment', 'return', 'scrap')),
  reference_type VARCHAR(50), -- e.g., 'purchase_order', 'sale_order', 'stock_adjustment'
  reference_id UUID, -- ID of the related document
  source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  source_location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  destination_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  destination_location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'processing', 'completed', 'cancelled')),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID NOT NULL, -- References users(id) from mainDb
  updated_by UUID, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Movement Lines
CREATE TABLE stock_movement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  serial_lot_id UUID REFERENCES serial_lot_numbers(id) ON DELETE SET NULL,
  quantity_ordered DECIMAL(15,2) NOT NULL,
  quantity_processed DECIMAL(15,2) DEFAULT 0,
  uom_id UUID REFERENCES units_of_measure(id),
  unit_cost DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Adjustments
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN ('cycle_count', 'write_off', 'damage', 'found', 'correction')),
  reference_number VARCHAR(100),
  adjustment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL, -- References users(id) from mainDb
  approved_by UUID, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Adjustment Lines
CREATE TABLE stock_adjustment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  warehouse_location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  counted_quantity DECIMAL(15,2) NOT NULL,
  system_quantity DECIMAL(15,2) NOT NULL,
  difference_quantity DECIMAL(15,2) GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SUPPLIERS & PURCHASING
-- ============================================

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  tax_id VARCHAR(100),
  payment_terms INTEGER DEFAULT 30, -- Days
  currency_code VARCHAR(3) DEFAULT 'INR',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, code)
);

-- Supplier Contacts
CREATE TABLE supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  position VARCHAR(100),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  po_number VARCHAR(100) NOT NULL,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled')),
  currency_code VARCHAR(3) DEFAULT 'INR',
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  created_by UUID NOT NULL, -- References users(id) from mainDb
  approved_by UUID, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, po_number)
);

-- Purchase Order Lines
CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  description TEXT,
  quantity_ordered DECIMAL(15,2) NOT NULL,
  quantity_received DECIMAL(15,2) DEFAULT 0,
  uom_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  expected_delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CUSTOMERS & SALES
-- ============================================

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  billing_address TEXT,
  shipping_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  tax_id VARCHAR(100),
  payment_terms INTEGER DEFAULT 30,
  currency_code VARCHAR(3) DEFAULT 'INR',
  credit_limit DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, code)
);

-- Customer Contacts
CREATE TABLE customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  position VARCHAR(100),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Orders
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  so_number VARCHAR(100) NOT NULL,
  so_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_progress', 'delivered', 'cancelled')),
  currency_code VARCHAR(3) DEFAULT 'INR',
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  shipping_address TEXT,
  notes TEXT,
  created_by UUID NOT NULL, -- References users(id) from mainDb
  approved_by UUID, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, so_number)
);

-- Sales Order Lines
CREATE TABLE sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  description TEXT,
  quantity_ordered DECIMAL(15,2) NOT NULL,
  quantity_delivered DECIMAL(15,2) DEFAULT 0,
  uom_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- MANUFACTURING (Basic)
-- ============================================

-- Bill of Materials
CREATE TABLE bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  bom_name VARCHAR(255) NOT NULL,
  bom_version VARCHAR(50) DEFAULT '1.0',
  quantity_produced DECIMAL(15,2) DEFAULT 1,
  uom_id UUID REFERENCES units_of_measure(id),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bill of Materials Lines
CREATE TABLE bom_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_header_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  component_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity_required DECIMAL(15,2) NOT NULL,
  uom_id UUID REFERENCES units_of_measure(id),
  scrap_percentage DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Manufacturing Orders
CREATE TABLE manufacturing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  bom_header_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  mo_number VARCHAR(100) NOT NULL,
  quantity_to_produce DECIMAL(15,2) NOT NULL,
  quantity_produced DECIMAL(15,2) DEFAULT 0,
  scheduled_start_date DATE,
  scheduled_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  notes TEXT,
  created_by UUID NOT NULL, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, mo_number)
);

-- ============================================
-- AUDIT & ACTIVITY LOGS
-- ============================================

-- ERP Activity Logs
CREATE TABLE erp_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- References users(id) from mainDb
  entity_type VARCHAR(100) NOT NULL, -- e.g., 'product', 'purchase_order'
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'approve'
  changes JSONB, -- Old and new values
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_erp_orgs_main_org ON erp_organizations(main_org_id);
CREATE INDEX idx_erp_depts_main_dept ON erp_departments(main_department_id);
CREATE INDEX idx_erp_user_access_user ON erp_user_access(main_user_id);
-- ============================================
-- SALES HISTORY & ANALYTICS
-- ============================================

-- Sales History for Forecasting - Aggregated sales data
CREATE TABLE sales_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  quantity_sold DECIMAL(15,2) NOT NULL DEFAULT 0,
  revenue DECIMAL(15,2) DEFAULT 0,
  cost_of_goods_sold DECIMAL(15,2) DEFAULT 0,
  number_of_orders INTEGER DEFAULT 0,
  average_order_quantity DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_erp_user_access_org ON erp_user_access(erp_organization_id);
CREATE INDEX idx_warehouses_org ON warehouses(erp_organization_id);
CREATE INDEX idx_products_org ON products(erp_organization_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_stock_levels_product ON stock_levels(product_id);
CREATE INDEX idx_stock_levels_warehouse ON stock_levels(warehouse_id);
CREATE INDEX idx_stock_movements_org ON stock_movements(erp_organization_id);
CREATE INDEX idx_stock_movements_ref ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_purchase_orders_org ON purchase_orders(erp_organization_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_sales_orders_org ON sales_orders(erp_organization_id);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_activity_logs_org ON erp_activity_logs(erp_organization_id);
CREATE INDEX idx_activity_logs_user ON erp_activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON erp_activity_logs(entity_type, entity_id);
CREATE INDEX idx_sales_history_product ON sales_history(product_id);
CREATE INDEX idx_sales_history_period ON sales_history(period_start, period_end);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================

-- Audit Logs for tracking all system changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  
  -- Entity information
  entity_type VARCHAR(50) NOT NULL, -- customers, products, warehouse, sales_orders, etc.
  entity_id UUID NOT NULL, -- ID of the entity that was modified
  
  -- Action details
  action VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE, VIEW, EXPORT, etc.
  changes JSONB, -- Store the actual changes made
  
  -- User information (references mainDb users via main_user_id)
  user_id UUID NOT NULL, -- References users(id) from mainDb
  user_name VARCHAR(255) NOT NULL,
  
  -- Request metadata
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX idx_audit_logs_org_id ON audit_logs(erp_organization_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_org_created ON audit_logs(erp_organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_org_entity ON audit_logs(erp_organization_id, entity_type, entity_id);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all ERP system operations';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity: customers, products, warehouse, sales_orders, purchase_orders, etc.';
COMMENT ON COLUMN audit_logs.entity_id IS 'UUID of the entity that was accessed or modified';
COMMENT ON COLUMN audit_logs.action IS 'Action performed: CREATE, UPDATE, DELETE, VIEW, EXPORT, IMPORT, etc.';
COMMENT ON COLUMN audit_logs.changes IS 'JSON object containing before/after values for updates';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the client making the request';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/client user agent string';

-- Note: Default units of measure should be created when an organization is onboarded
-- Example SQL to insert default UOMs for a new organization:
/*
INSERT INTO units_of_measure (erp_organization_id, name, code, uom_type, is_base_unit) VALUES
  ('<your-org-id>', 'Unit', 'UNIT', 'unit', true),
  ('<your-org-id>', 'Kilogram', 'KG', 'weight', true),
  ('<your-org-id>', 'Gram', 'G', 'weight', false),
  ('<your-org-id>', 'Liter', 'L', 'volume', true),
  ('<your-org-id>', 'Milliliter', 'ML', 'volume', false),
  ('<your-org-id>', 'Meter', 'M', 'length', true),
  ('<your-org-id>', 'Centimeter', 'CM', 'length', false);
*/

-- ============================================
-- FINANCE MODULE - GST-FIRST INDIAN ACCOUNTING
-- ============================================
-- Complete Indian GST compliance with accounting integration
-- All tables reference erp_organizations for multi-tenancy
-- ============================================

-- ============================================
-- PART 1: GST MASTER DATA & CONFIGURATION
-- ============================================

-- Indian States Master Data
CREATE TABLE IF NOT EXISTS indian_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code VARCHAR(2) NOT NULL UNIQUE,
    state_name VARCHAR(100) NOT NULL UNIQUE,
    tin_code VARCHAR(2) NOT NULL,
    is_union_territory BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GST Configuration per Organization (Multiple GSTINs supported)
CREATE TABLE IF NOT EXISTS gst_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    gstin VARCHAR(15) NOT NULL UNIQUE,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    state_code VARCHAR(2) NOT NULL REFERENCES indian_states(state_code),
    registration_date DATE NOT NULL,
    gst_type VARCHAR(20) NOT NULL CHECK (gst_type IN ('regular', 'composition', 'sez')),
    composition_scheme BOOLEAN DEFAULT false,
    annual_turnover DECIMAL(15,2),
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_gstin_format CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')
);

CREATE INDEX IF NOT EXISTS idx_gst_config_org ON gst_configuration(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_gst_config_gstin ON gst_configuration(gstin);
CREATE INDEX IF NOT EXISTS idx_gst_config_state ON gst_configuration(state_code);

-- HSN/SAC Code Master (Goods and Services Classification)
CREATE TABLE IF NOT EXISTS hsn_sac_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_type VARCHAR(10) NOT NULL CHECK (code_type IN ('HSN', 'SAC')),
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    uqc VARCHAR(10), -- Unit Quantity Code as per GST
    default_gst_rate DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hsn_sac_code ON hsn_sac_codes(code);
CREATE INDEX IF NOT EXISTS idx_hsn_sac_type ON hsn_sac_codes(code_type);

-- GST Rate Master (Configurable - NO HARDCODING)
CREATE TABLE IF NOT EXISTS gst_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    rate_name VARCHAR(100) NOT NULL,
    cgst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    sgst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    igst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    cess_rate DECIMAL(5,2) DEFAULT 0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_gst_rate_sum CHECK (cgst_rate + sgst_rate = igst_rate)
);

CREATE INDEX IF NOT EXISTS idx_gst_rates_org ON gst_rates(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_gst_rates_effective ON gst_rates(effective_from, effective_to);

-- Product GST Mapping (Link products to HSN and tax rates)
CREATE TABLE IF NOT EXISTS product_gst_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    hsn_sac_code_id UUID REFERENCES hsn_sac_codes(id),
    gst_rate_id UUID REFERENCES gst_rates(id),
    is_taxable BOOLEAN DEFAULT true,
    is_rcm_applicable BOOLEAN DEFAULT false, -- Reverse Charge Mechanism
    exemption_reason VARCHAR(255),
    itc_eligibility VARCHAR(50) DEFAULT 'eligible' CHECK (itc_eligibility IN ('eligible', 'ineligible', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_gst_product ON product_gst_mapping(product_id);
CREATE INDEX IF NOT EXISTS idx_product_gst_hsn ON product_gst_mapping(hsn_sac_code_id);

-- Vendor GST Details (Supplier GST compliance tracking)
CREATE TABLE IF NOT EXISTS vendor_gst_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    gstin VARCHAR(15),
    pan_number VARCHAR(10),
    state_code VARCHAR(2) REFERENCES indian_states(state_code),
    vendor_type VARCHAR(20) DEFAULT 'registered' CHECK (vendor_type IN ('registered', 'unregistered', 'composition', 'overseas')),
    is_msme BOOLEAN DEFAULT false,
    msme_number VARCHAR(50),
    gst_compliant BOOLEAN DEFAULT true,
    compliance_score INTEGER DEFAULT 100 CHECK (compliance_score BETWEEN 0 AND 100),
    last_compliance_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_vendor_gstin_format CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
    UNIQUE(supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_gst_supplier ON vendor_gst_details(supplier_id);
CREATE INDEX IF NOT EXISTS idx_vendor_gst_gstin ON vendor_gst_details(gstin);

-- Customer GST Details
CREATE TABLE IF NOT EXISTS customer_gst_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    gstin VARCHAR(15),
    pan_number VARCHAR(10),
    state_code VARCHAR(2) REFERENCES indian_states(state_code),
    customer_type VARCHAR(20) DEFAULT 'registered' CHECK (customer_type IN ('registered', 'unregistered', 'consumer', 'sez', 'export')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_customer_gstin_format CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
    UNIQUE(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_gst_customer ON customer_gst_details(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_gst_gstin ON customer_gst_details(gstin);

-- ============================================
-- PART 2: CHART OF ACCOUNTS (GST-AWARE)
-- ============================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    account_subtype VARCHAR(100), -- 'current_asset', 'accounts_receivable', 'tax_liability', etc.
    parent_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    is_gst_account BOOLEAN DEFAULT false,
    gst_account_type VARCHAR(20) CHECK (gst_account_type IN ('cgst_input', 'sgst_input', 'igst_input', 'cgst_output', 'sgst_output', 'igst_output', 'cess', 'rcm')),
    currency VARCHAR(10) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    is_system_account BOOLEAN DEFAULT false,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    opening_balance_date DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, account_code)
);

-- Add missing columns to chart_of_accounts if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chart_of_accounts' AND column_name='is_gst_account') THEN
        ALTER TABLE chart_of_accounts ADD COLUMN is_gst_account BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chart_of_accounts' AND column_name='gst_account_type') THEN
        ALTER TABLE chart_of_accounts ADD COLUMN gst_account_type VARCHAR(20) CHECK (gst_account_type IN ('cgst_input', 'sgst_input', 'igst_input', 'cgst_output', 'sgst_output', 'igst_output', 'cess', 'rcm'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chart_of_accounts' AND column_name='currency') THEN
        ALTER TABLE chart_of_accounts ADD COLUMN currency VARCHAR(10) DEFAULT 'INR';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chart_of_accounts' AND column_name='is_system_account') THEN
        ALTER TABLE chart_of_accounts ADD COLUMN is_system_account BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chart_of_accounts' AND column_name='opening_balance') THEN
        ALTER TABLE chart_of_accounts ADD COLUMN opening_balance DECIMAL(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chart_of_accounts' AND column_name='opening_balance_date') THEN
        ALTER TABLE chart_of_accounts ADD COLUMN opening_balance_date DATE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coa_organization ON chart_of_accounts(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_coa_gst_type ON chart_of_accounts(gst_account_type);

-- ============================================
-- PART 3: JOURNAL ENTRIES & GENERAL LEDGER
-- ============================================

-- Journal Entry Header (Double-entry bookkeeping)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    journal_number VARCHAR(50) NOT NULL,
    journal_type VARCHAR(50) NOT NULL CHECK (journal_type IN ('general', 'sales', 'purchase', 'payment', 'receipt', 'opening', 'closing', 'adjustment')),
    transaction_date DATE NOT NULL,
    posting_date DATE NOT NULL,
    reference_type VARCHAR(50), -- 'sales_invoice', 'purchase_invoice', 'payment', 'stock_valuation'
    reference_id UUID,
    reference_number VARCHAR(100),
    narration TEXT NOT NULL,
    total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
    fiscal_year VARCHAR(10) NOT NULL, -- '2025-26'
    fiscal_period INTEGER NOT NULL CHECK (fiscal_period BETWEEN 1 AND 12),
    is_auto_generated BOOLEAN DEFAULT false,
    reversed_by_journal_id UUID REFERENCES journal_entries(id),
    created_by UUID, -- References mainDb users
    posted_by UUID,
    posted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, journal_number),
    CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit)
);

CREATE INDEX IF NOT EXISTS idx_je_organization ON journal_entries(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(transaction_date);
CREATE INDEX IF NOT EXISTS idx_je_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_je_fiscal ON journal_entries(fiscal_year, fiscal_period);
CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);

-- General Ledger (Individual GL entries)
CREATE TABLE IF NOT EXISTS general_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    transaction_date DATE NOT NULL,
    posting_date DATE NOT NULL,
    description TEXT,
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    balance_amount DECIMAL(15,2) DEFAULT 0, -- Running balance
    currency VARCHAR(10) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    fiscal_year VARCHAR(10) NOT NULL,
    fiscal_period INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_gl_debit_or_credit CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))
);

CREATE INDEX IF NOT EXISTS idx_gl_organization ON general_ledger(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_gl_journal ON general_ledger(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_gl_account ON general_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_gl_date ON general_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_gl_fiscal ON general_ledger(fiscal_year, fiscal_period);

-- ============================================
-- PART 4: SALES INVOICES WITH GST
-- ============================================

CREATE TABLE IF NOT EXISTS sales_invoices_gst (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    invoice_type VARCHAR(30) NOT NULL DEFAULT 'tax_invoice' CHECK (invoice_type IN ('tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note', 'export_invoice')),
    sales_order_id UUID REFERENCES sales_orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_gstin VARCHAR(15),
    customer_state_code VARCHAR(2),
    
    -- Dates
    invoice_date DATE NOT NULL,
    supply_date DATE,
    due_date DATE NOT NULL,
    financial_year VARCHAR(10) NOT NULL, -- '2025-26'
    
    -- Place of Supply (CRITICAL for CGST/SGST vs IGST)
    place_of_supply VARCHAR(2) NOT NULL, -- State code
    is_inter_state BOOLEAN NOT NULL DEFAULT false,
    
    -- Amounts
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    taxable_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- GST Breakdown
    cgst_amount DECIMAL(15,2) DEFAULT 0,
    sgst_amount DECIMAL(15,2) DEFAULT 0,
    igst_amount DECIMAL(15,2) DEFAULT 0,
    cess_amount DECIMAL(15,2) DEFAULT 0,
    total_gst_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Final Amount
    round_off_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    
    -- Payment Tracking
    paid_amount DECIMAL(15,2) DEFAULT 0,
    balance_amount DECIMAL(15,2) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'partially_paid', 'paid', 'cancelled')),
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'overdue')),
    
    -- E-Invoicing (IRN system for B2B)
    irn VARCHAR(100), -- Invoice Reference Number
    ack_number VARCHAR(100),
    ack_date TIMESTAMP WITH TIME ZONE,
    qr_code TEXT,
    e_invoice_generated BOOLEAN DEFAULT false,
    
    -- GSTR Filing
    gstr1_filed BOOLEAN DEFAULT false,
    gstr1_period VARCHAR(10), -- 'Jan-2026'
    
    -- Accounting
    gl_posted BOOLEAN DEFAULT false,
    journal_entry_id UUID REFERENCES journal_entries(id),
    
    -- Additional
    payment_terms VARCHAR(100),
    notes TEXT,
    terms_and_conditions TEXT,
    created_by UUID,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(erp_organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_sales_inv_gst_org ON sales_invoices_gst(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_inv_gst_customer ON sales_invoices_gst(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_inv_gst_date ON sales_invoices_gst(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_inv_gst_fy ON sales_invoices_gst(financial_year);
CREATE INDEX IF NOT EXISTS idx_sales_inv_gst_status ON sales_invoices_gst(status);
CREATE INDEX IF NOT EXISTS idx_sales_inv_gst_irn ON sales_invoices_gst(irn);

-- Sales Invoice Line Items
CREATE TABLE IF NOT EXISTS sales_invoice_lines_gst (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES sales_invoices_gst(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    hsn_sac_code VARCHAR(10),
    
    description TEXT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_of_measurement VARCHAR(20) NOT NULL DEFAULT 'NOS',
    unit_price DECIMAL(15,2) NOT NULL,
    
    -- Discount
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Taxable Amount
    taxable_amount DECIMAL(15,2) NOT NULL,
    
    -- GST Rates
    gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    cgst_rate DECIMAL(5,2) DEFAULT 0,
    sgst_rate DECIMAL(5,2) DEFAULT 0,
    igst_rate DECIMAL(5,2) DEFAULT 0,
    cess_rate DECIMAL(5,2) DEFAULT 0,
    
    -- GST Amounts
    cgst_amount DECIMAL(15,2) DEFAULT 0,
    sgst_amount DECIMAL(15,2) DEFAULT 0,
    igst_amount DECIMAL(15,2) DEFAULT 0,
    cess_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Line Total
    line_total DECIMAL(15,2) NOT NULL,
    
    -- Accounting
    revenue_account_id UUID REFERENCES chart_of_accounts(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_inv_lines_gst_invoice ON sales_invoice_lines_gst(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_inv_lines_gst_product ON sales_invoice_lines_gst(product_id);

-- ============================================
-- PART 5: PURCHASE INVOICES WITH GST & ITC
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_invoices_gst (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL, -- Our internal number
    vendor_invoice_number VARCHAR(100) NOT NULL, -- Vendor's invoice number (CRITICAL)
    invoice_type VARCHAR(30) NOT NULL DEFAULT 'purchase_invoice' CHECK (invoice_type IN ('purchase_invoice', 'debit_note', 'credit_note', 'import_invoice')),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    supplier_gstin VARCHAR(15),
    supplier_state_code VARCHAR(2),
    
    -- Dates
    invoice_date DATE NOT NULL,
    supply_date DATE,
    due_date DATE NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    
    -- Place of Supply
    place_of_supply VARCHAR(2) NOT NULL,
    is_inter_state BOOLEAN NOT NULL DEFAULT false,
    
    -- Reverse Charge Mechanism
    is_rcm_applicable BOOLEAN DEFAULT false,
    rcm_cgst_amount DECIMAL(15,2) DEFAULT 0,
    rcm_sgst_amount DECIMAL(15,2) DEFAULT 0,
    rcm_igst_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Amounts
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    taxable_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- GST Breakdown
    cgst_amount DECIMAL(15,2) DEFAULT 0,
    sgst_amount DECIMAL(15,2) DEFAULT 0,
    igst_amount DECIMAL(15,2) DEFAULT 0,
    cess_amount DECIMAL(15,2) DEFAULT 0,
    total_gst_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Final Amount
    round_off_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    
    -- ITC (Input Tax Credit) - THE HEART OF PURCHASE GST
    itc_eligible BOOLEAN DEFAULT true,
    itc_cgst_amount DECIMAL(15,2) DEFAULT 0,
    itc_sgst_amount DECIMAL(15,2) DEFAULT 0,
    itc_igst_amount DECIMAL(15,2) DEFAULT 0,
    itc_blocked_amount DECIMAL(15,2) DEFAULT 0, -- Section 17(5) blocked credits
    itc_reversed_amount DECIMAL(15,2) DEFAULT 0,
    itc_claimed BOOLEAN DEFAULT false,
    itc_claimed_period VARCHAR(10), -- 'Jan-2026'
    
    -- Payment Tracking
    paid_amount DECIMAL(15,2) DEFAULT 0,
    balance_amount DECIMAL(15,2) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted', 'partially_paid', 'paid', 'cancelled')),
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'overdue')),
    
    -- GSTR-2A/2B Matching
    gstr2a_matched BOOLEAN DEFAULT false,
    gstr2a_match_date TIMESTAMP WITH TIME ZONE,
    gstr2b_available BOOLEAN DEFAULT false,
    
    -- Accounting
    gl_posted BOOLEAN DEFAULT false,
    journal_entry_id UUID REFERENCES journal_entries(id),
    
    -- Workflow
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional
    payment_terms VARCHAR(100),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(erp_organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_inv_gst_org ON purchase_invoices_gst(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_inv_gst_supplier ON purchase_invoices_gst(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_inv_gst_date ON purchase_invoices_gst(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_inv_gst_fy ON purchase_invoices_gst(financial_year);
CREATE INDEX IF NOT EXISTS idx_purchase_inv_gst_status ON purchase_invoices_gst(status);
CREATE INDEX IF NOT EXISTS idx_purchase_inv_gst_itc ON purchase_invoices_gst(itc_eligible, itc_claimed);

-- Purchase Invoice Line Items
CREATE TABLE IF NOT EXISTS purchase_invoice_lines_gst (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES purchase_invoices_gst(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    hsn_sac_code VARCHAR(10),
    
    description TEXT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_of_measurement VARCHAR(20) NOT NULL DEFAULT 'NOS',
    unit_price DECIMAL(15,2) NOT NULL,
    
    -- Taxable Amount
    taxable_amount DECIMAL(15,2) NOT NULL,
    
    -- GST Rates
    gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    cgst_rate DECIMAL(5,2) DEFAULT 0,
    sgst_rate DECIMAL(5,2) DEFAULT 0,
    igst_rate DECIMAL(5,2) DEFAULT 0,
    cess_rate DECIMAL(5,2) DEFAULT 0,
    
    -- GST Amounts
    cgst_amount DECIMAL(15,2) DEFAULT 0,
    sgst_amount DECIMAL(15,2) DEFAULT 0,
    igst_amount DECIMAL(15,2) DEFAULT 0,
    cess_amount DECIMAL(15,2) DEFAULT 0,
    
    -- ITC Per Line
    itc_eligible BOOLEAN DEFAULT true,
    itc_cgst_amount DECIMAL(15,2) DEFAULT 0,
    itc_sgst_amount DECIMAL(15,2) DEFAULT 0,
    itc_igst_amount DECIMAL(15,2) DEFAULT 0,
    itc_block_reason VARCHAR(255), -- e.g., "Section 17(5) - Motor Vehicle"
    
    -- Line Total
    line_total DECIMAL(15,2) NOT NULL,
    
    -- Accounting
    expense_account_id UUID REFERENCES chart_of_accounts(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_inv_lines_gst_invoice ON purchase_invoice_lines_gst(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_inv_lines_gst_product ON purchase_invoice_lines_gst(product_id);

-- ============================================
-- PART 6: PAYMENTS & RECEIPTS
-- ============================================

-- Customer Payments (Money In)
CREATE TABLE IF NOT EXISTS customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    payment_number VARCHAR(50) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card', 'debit_card', 'upi', 'razorpay', 'other')),
    reference_number VARCHAR(100),
    bank_account_id UUID, -- Our bank account that received money
    notes TEXT,
    
    -- Accounting
    gl_posted BOOLEAN DEFAULT false,
    journal_entry_id UUID REFERENCES journal_entries(id),
    
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_org ON customer_payments(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(payment_date);

-- Payment Allocations (Link payments to invoices)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES sales_invoices_gst(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing invoice_id column to payment_allocations if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='payment_allocations' 
                   AND column_name='invoice_id') THEN
        ALTER TABLE payment_allocations ADD COLUMN invoice_id UUID REFERENCES sales_invoices_gst(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON payment_allocations(invoice_id);

-- Vendor Payments (Money Out)
CREATE TABLE IF NOT EXISTS vendor_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    payment_number VARCHAR(50) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card', 'debit_card', 'upi', 'neft', 'rtgs', 'imps', 'other')),
    reference_number VARCHAR(100),
    bank_account_id UUID, -- Our bank account from which money was paid
    notes TEXT,
    
    -- TDS (Tax Deducted at Source) if applicable
    tds_applicable BOOLEAN DEFAULT false,
    tds_amount DECIMAL(15,2) DEFAULT 0,
    tds_section VARCHAR(50), -- e.g., '194C', '194J'
    
    -- Accounting
    gl_posted BOOLEAN DEFAULT false,
    journal_entry_id UUID REFERENCES journal_entries(id),
    
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_vendor_payments_org ON vendor_payments(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_supplier ON vendor_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_date ON vendor_payments(payment_date);

-- Vendor Payment Allocations
CREATE TABLE IF NOT EXISTS vendor_payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES vendor_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES purchase_invoices_gst(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing invoice_id column to vendor_payment_allocations if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='vendor_payment_allocations' 
                   AND column_name='invoice_id') THEN
        ALTER TABLE vendor_payment_allocations ADD COLUMN invoice_id UUID REFERENCES purchase_invoices_gst(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_payment_allocations_payment ON vendor_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_allocations_invoice ON vendor_payment_allocations(invoice_id);

-- ============================================
-- PART 7: GST REPORTS & COMPLIANCE TABLES
-- ============================================

-- GSTR-1 Summary (Outward Supplies)
CREATE TABLE IF NOT EXISTS gstr1_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    gstin VARCHAR(15) NOT NULL,
    return_period VARCHAR(10) NOT NULL, -- 'Jan-2026', 'Q1-2026'
    financial_year VARCHAR(10) NOT NULL,
    
    -- B2B Supplies (Business to Business)
    b2b_invoices_count INTEGER DEFAULT 0,
    b2b_taxable_value DECIMAL(15,2) DEFAULT 0,
    b2b_igst_amount DECIMAL(15,2) DEFAULT 0,
    b2b_cgst_amount DECIMAL(15,2) DEFAULT 0,
    b2b_sgst_amount DECIMAL(15,2) DEFAULT 0,
    b2b_cess_amount DECIMAL(15,2) DEFAULT 0,
    
    -- B2C Supplies (Business to Consumer)
    b2c_large_invoices_count INTEGER DEFAULT 0, -- > Rs 2.5 lakhs
    b2c_large_taxable_value DECIMAL(15,2) DEFAULT 0,
    b2c_other_taxable_value DECIMAL(15,2) DEFAULT 0,
    
    -- Exports
    export_taxable_value DECIMAL(15,2) DEFAULT 0,
    export_igst_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Credit/Debit Notes
    credit_notes_count INTEGER DEFAULT 0,
    credit_notes_value DECIMAL(15,2) DEFAULT 0,
    debit_notes_count INTEGER DEFAULT 0,
    debit_notes_value DECIMAL(15,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'filed', 'amended')),
    generated_at TIMESTAMP WITH TIME ZONE,
    filed_at TIMESTAMP WITH TIME ZONE,
    arn VARCHAR(100), -- Acknowledgement Reference Number
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, gstin, return_period)
);

CREATE INDEX IF NOT EXISTS idx_gstr1_org ON gstr1_summary(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_gstr1_period ON gstr1_summary(return_period);

-- GSTR-3B Summary (Monthly Return with ITC)
CREATE TABLE IF NOT EXISTS gstr3b_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    gstin VARCHAR(15) NOT NULL,
    return_period VARCHAR(10) NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    
    -- Table 3.1(a) - Outward Taxable Supplies
    outward_taxable_supplies DECIMAL(15,2) DEFAULT 0,
    outward_igst DECIMAL(15,2) DEFAULT 0,
    outward_cgst DECIMAL(15,2) DEFAULT 0,
    outward_sgst DECIMAL(15,2) DEFAULT 0,
    outward_cess DECIMAL(15,2) DEFAULT 0,
    
    -- Table 3.1(d) - Inward Supplies liable to RCM
    inward_rcm_taxable_value DECIMAL(15,2) DEFAULT 0,
    inward_rcm_igst DECIMAL(15,2) DEFAULT 0,
    inward_rcm_cgst DECIMAL(15,2) DEFAULT 0,
    inward_rcm_sgst DECIMAL(15,2) DEFAULT 0,
    
    -- Table 4(A) - ITC Available
    itc_igst_available DECIMAL(15,2) DEFAULT 0,
    itc_cgst_available DECIMAL(15,2) DEFAULT 0,
    itc_sgst_available DECIMAL(15,2) DEFAULT 0,
    itc_cess_available DECIMAL(15,2) DEFAULT 0,
    
    -- Table 4(B) - ITC Reversed
    itc_igst_reversed DECIMAL(15,2) DEFAULT 0,
    itc_cgst_reversed DECIMAL(15,2) DEFAULT 0,
    itc_sgst_reversed DECIMAL(15,2) DEFAULT 0,
    
    -- Net ITC Available
    net_itc_igst DECIMAL(15,2) DEFAULT 0,
    net_itc_cgst DECIMAL(15,2) DEFAULT 0,
    net_itc_sgst DECIMAL(15,2) DEFAULT 0,
    
    -- Table 5 - Tax Payable
    igst_payable DECIMAL(15,2) DEFAULT 0,
    cgst_payable DECIMAL(15,2) DEFAULT 0,
    sgst_payable DECIMAL(15,2) DEFAULT 0,
    cess_payable DECIMAL(15,2) DEFAULT 0,
    
    -- Interest & Late Fee
    interest_amount DECIMAL(15,2) DEFAULT 0,
    late_fee_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'filed', 'amended')),
    generated_at TIMESTAMP WITH TIME ZONE,
    filed_at TIMESTAMP WITH TIME ZONE,
    arn VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, gstin, return_period)
);

CREATE INDEX IF NOT EXISTS idx_gstr3b_org ON gstr3b_summary(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_gstr3b_period ON gstr3b_summary(return_period);

-- ITC Ledger (Input Tax Credit Tracking)
CREATE TABLE IF NOT EXISTS itc_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('claim', 'reversal', 'adjustment', 'utilized')),
    reference_type VARCHAR(50), -- 'purchase_invoice', 'credit_note', 'manual_entry'
    reference_id UUID,
    reference_number VARCHAR(100),
    
    supplier_id UUID REFERENCES suppliers(id),
    supplier_gstin VARCHAR(15),
    
    -- ITC Amounts
    igst_amount DECIMAL(15,2) DEFAULT 0,
    cgst_amount DECIMAL(15,2) DEFAULT 0,
    sgst_amount DECIMAL(15,2) DEFAULT 0,
    cess_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Tracking
    claimed_period VARCHAR(10), -- 'Jan-2026'
    reversal_reason TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itc_ledger_org ON itc_ledger(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_itc_ledger_date ON itc_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_itc_ledger_type ON itc_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_itc_ledger_period ON itc_ledger(claimed_period);

-- ============================================
-- PART 8: BANK ACCOUNTS
-- ============================================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255),
    ifsc_code VARCHAR(20),
    swift_code VARCHAR(20),
    account_type VARCHAR(50) DEFAULT 'current' CHECK (account_type IN ('savings', 'current', 'od', 'cc')),
    currency VARCHAR(10) DEFAULT 'INR',
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    gl_account_id UUID REFERENCES chart_of_accounts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_org ON bank_accounts(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_gl ON bank_accounts(gl_account_id);

-- ============================================
-- PART 9: FINANCIAL YEAR CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS financial_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    year_name VARCHAR(20) NOT NULL, -- '2025-26', 'FY2025-26'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    is_closed BOOLEAN DEFAULT false,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, year_name)
);

CREATE INDEX IF NOT EXISTS idx_financial_years_org ON financial_years(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_years_current ON financial_years(is_current);

-- ============================================
-- PART 10: TRIAL BALANCE CACHE (Performance)
-- ============================================

CREATE TABLE IF NOT EXISTS trial_balance_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    fiscal_year VARCHAR(10) NOT NULL,
    fiscal_period INTEGER NOT NULL CHECK (fiscal_period BETWEEN 0 AND 12), -- 0 = full year
    opening_balance DECIMAL(15,2) DEFAULT 0,
    total_debit DECIMAL(15,2) DEFAULT 0,
    total_credit DECIMAL(15,2) DEFAULT 0,
    closing_balance DECIMAL(15,2) DEFAULT 0,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, account_id, fiscal_year, fiscal_period)
);

CREATE INDEX IF NOT EXISTS idx_trial_balance_org ON trial_balance_cache(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_trial_balance_fiscal ON trial_balance_cache(fiscal_year, fiscal_period);

-- ============================================
-- PART 11: SEED DATA - INDIAN STATES
-- ============================================

INSERT INTO indian_states (state_code, state_name, tin_code, is_union_territory) VALUES
('01', 'Jammu and Kashmir', '01', true),
('02', 'Himachal Pradesh', '02', false),
('03', 'Punjab', '03', false),
('04', 'Chandigarh', '04', true),
('05', 'Uttarakhand', '05', false),
('06', 'Haryana', '06', false),
('07', 'Delhi', '07', true),
('08', 'Rajasthan', '08', false),
('09', 'Uttar Pradesh', '09', false),
('10', 'Bihar', '10', false),
('11', 'Sikkim', '11', false),
('12', 'Arunachal Pradesh', '12', false),
('13', 'Nagaland', '13', false),
('14', 'Manipur', '14', false),
('15', 'Mizoram', '15', false),
('16', 'Tripura', '16', false),
('17', 'Meghalaya', '17', false),
('18', 'Assam', '18', false),
('19', 'West Bengal', '19', false),
('20', 'Jharkhand', '20', false),
('21', 'Odisha', '21', false),
('22', 'Chhattisgarh', '22', false),
('23', 'Madhya Pradesh', '23', false),
('24', 'Gujarat', '24', false),
('25', 'Daman and Diu', '25', true),
('26', 'Dadra and Nagar Haveli and Daman and Diu', '26', true),
('27', 'Maharashtra', '27', false),
('28', 'Andhra Pradesh (Before Division)', '28', false),
('29', 'Karnataka', '29', false),
('30', 'Goa', '30', false),
('31', 'Lakshadweep', '31', true),
('32', 'Kerala', '32', false),
('33', 'Tamil Nadu', '33', false),
('34', 'Puducherry', '34', true),
('35', 'Andaman and Nicobar Islands', '35', true),
('36', 'Telangana', '36', false),
('37', 'Andhra Pradesh (New)', '37', false),
('38', 'Ladakh', '38', true),
('97', 'Other Territory', '97', false),
('99', 'Centre Jurisdiction', '99', false)
ON CONFLICT (state_code) DO NOTHING;

-- ============================================
-- FINANCE MODULE READY
-- Run the entire file in PGAdmin to update your database
-- All tables are production-ready with proper indexes
-- GST-first architecture with full ITC tracking
-- Integrates with existing ERP modules via reference fields
-- ============================================

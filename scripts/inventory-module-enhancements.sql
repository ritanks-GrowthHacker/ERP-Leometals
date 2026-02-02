-- ============================================
-- INVENTORY MODULE ENHANCEMENTS
-- Additional tables and features for complete inventory management
-- Run this script in PG Admin after the main erpDb.sql
-- ============================================

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(product_category_id);
CREATE INDEX IF NOT EXISTS idx_products_org ON products(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_product ON stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_warehouse ON stock_levels(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON stock_movements(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status);

-- Add computed column for stock availability if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_levels' AND column_name = 'quantity_available'
  ) THEN
    ALTER TABLE stock_levels 
    ADD COLUMN quantity_available DECIMAL(15,2) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED;
  END IF;
END $$;

-- Product Images table (support multiple images per product)
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  alt_text VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- Product Suppliers (track which suppliers can supply which products)
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku VARCHAR(100),
  supplier_product_name VARCHAR(255),
  cost_price DECIMAL(15,2),
  currency_code VARCHAR(3) DEFAULT 'USD',
  lead_time_days INTEGER DEFAULT 0,
  minimum_order_quantity DECIMAL(15,2) DEFAULT 1,
  is_preferred BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON product_suppliers(supplier_id);

-- Stock Alerts (automated reorder alerts)
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock', 'expiry_warning')),
  alert_level VARCHAR(50) DEFAULT 'warning' CHECK (alert_level IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  current_quantity DECIMAL(15,2),
  threshold_quantity DECIMAL(15,2),
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID, -- References users(id) from mainDb
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_alerts_active_unique 
  ON stock_alerts(product_id, warehouse_id, alert_type) 
  WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_resolved ON stock_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_org ON stock_alerts(erp_organization_id);

-- Inventory Valuation History (track inventory value over time)
CREATE TABLE IF NOT EXISTS inventory_valuation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_quantity DECIMAL(15,2) DEFAULT 0,
  total_value DECIMAL(15,2) DEFAULT 0,
  valuation_method VARCHAR(50) DEFAULT 'fifo' CHECK (valuation_method IN ('fifo', 'lifo', 'weighted_average', 'standard_cost')),
  details JSONB DEFAULT '{}', -- Store per-product breakdown
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, warehouse_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_valuation_snapshots_org ON inventory_valuation_snapshots(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_valuation_snapshots_date ON inventory_valuation_snapshots(snapshot_date);

-- Stock Movement Tracking (detailed audit log)
CREATE TABLE IF NOT EXISTS stock_movement_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'confirmed', 'processing', 'completed', 'cancelled')),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  performed_by UUID NOT NULL, -- References users(id) from mainDb
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movement_audit_movement ON stock_movement_audit(stock_movement_id);

-- Barcode Scans Log (track all barcode scanning activity)
CREATE TABLE IF NOT EXISTS barcode_scan_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  barcode VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  scan_type VARCHAR(50) CHECK (scan_type IN ('receipt', 'picking', 'count', 'verification', 'other')),
  scanned_by UUID NOT NULL, -- References users(id) from mainDb
  device_info JSONB DEFAULT '{}',
  location_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barcode_scans_org ON barcode_scan_log(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_product ON barcode_scan_log(product_id);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_date ON barcode_scan_log(created_at);

-- Product Kits/Bundles (products that are composed of other products)
CREATE TABLE IF NOT EXISTS product_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
  is_optional BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(kit_product_id, component_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_kits_kit ON product_kits(kit_product_id);

-- Inventory Analytics Views
CREATE OR REPLACE VIEW v_stock_summary AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.sku,
  p.erp_organization_id,
  pc.name as category_name,
  w.id as warehouse_id,
  w.name as warehouse_name,
  COALESCE(sl.quantity_on_hand, 0) as quantity_on_hand,
  COALESCE(sl.quantity_reserved, 0) as quantity_reserved,
  COALESCE(sl.quantity_available, 0) as quantity_available,
  p.reorder_point,
  p.cost_price,
  p.sale_price,
  COALESCE(sl.quantity_on_hand, 0) * p.cost_price as inventory_value,
  CASE 
    WHEN COALESCE(sl.quantity_available, 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(sl.quantity_available, 0) <= p.reorder_point THEN 'low_stock'
    ELSE 'in_stock'
  END as stock_status
FROM products p
LEFT JOIN product_categories pc ON p.product_category_id = pc.id
CROSS JOIN warehouses w
LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.warehouse_id = w.id
WHERE p.erp_organization_id = w.erp_organization_id AND p.is_active = true;

-- View for products needing reorder
CREATE OR REPLACE VIEW v_reorder_suggestions AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.sku,
  p.erp_organization_id,
  w.id as warehouse_id,
  w.name as warehouse_name,
  COALESCE(sl.quantity_available, 0) as current_stock,
  p.reorder_point,
  p.reorder_quantity,
  p.reorder_quantity - COALESCE(sl.quantity_available, 0) as suggested_order_quantity,
  p.lead_time_days,
  ps.supplier_id,
  s.name as preferred_supplier_name,
  ps.cost_price as supplier_cost_price,
  ps.lead_time_days as supplier_lead_time_days
FROM products p
CROSS JOIN warehouses w
LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.warehouse_id = w.id
LEFT JOIN product_suppliers ps ON ps.product_id = p.id AND ps.is_preferred = true
LEFT JOIN suppliers s ON s.id = ps.supplier_id
WHERE p.erp_organization_id = w.erp_organization_id 
  AND p.is_active = true
  AND COALESCE(sl.quantity_available, 0) <= p.reorder_point
ORDER BY (p.reorder_point - COALESCE(sl.quantity_available, 0)) DESC;

-- Function to automatically create stock alert
CREATE OR REPLACE FUNCTION fn_check_stock_levels()
RETURNS TRIGGER AS $$
DECLARE
  v_quantity_available DECIMAL(15,2);
  v_reorder_point DECIMAL(15,2);
BEGIN
  -- Calculate available quantity
  v_quantity_available := COALESCE(NEW.quantity_on_hand, 0) - COALESCE(NEW.quantity_reserved, 0);
  
  -- Get reorder point
  SELECT reorder_point INTO v_reorder_point FROM products WHERE id = NEW.product_id;
  
  -- Check for low stock or out of stock
  IF v_quantity_available <= v_reorder_point THEN
    INSERT INTO stock_alerts (
      erp_organization_id,
      product_id,
      warehouse_id,
      alert_type,
      alert_level,
      message,
      current_quantity,
      threshold_quantity
    )
    SELECT 
      p.erp_organization_id,
      NEW.product_id,
      NEW.warehouse_id,
      CASE 
        WHEN v_quantity_available <= 0 THEN 'out_of_stock'
        ELSE 'low_stock'
      END,
      CASE 
        WHEN v_quantity_available <= 0 THEN 'critical'
        ELSE 'warning'
      END,
      CASE 
        WHEN v_quantity_available <= 0 THEN 'Product ' || p.name || ' is OUT OF STOCK in warehouse ' || w.name
        ELSE 'Product ' || p.name || ' is below reorder point in warehouse ' || w.name
      END,
      v_quantity_available,
      p.reorder_point
    FROM products p
    JOIN warehouses w ON w.id = NEW.warehouse_id
    WHERE p.id = NEW.product_id
    ON CONFLICT (product_id, warehouse_id, alert_type) 
    WHERE is_resolved = false
    DO UPDATE SET 
      current_quantity = EXCLUDED.current_quantity,
      message = EXCLUDED.message,
      alert_level = EXCLUDED.alert_level,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check stock levels after update
DROP TRIGGER IF EXISTS trg_check_stock_levels ON stock_levels;
CREATE TRIGGER trg_check_stock_levels
  AFTER INSERT OR UPDATE OF quantity_on_hand, quantity_reserved
  ON stock_levels
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_stock_levels();

-- Function to update stock levels from movements
CREATE OR REPLACE FUNCTION fn_update_stock_from_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update stock levels based on movement type
    IF NEW.movement_type IN ('receipt', 'internal_transfer', 'return') THEN
      -- Increase destination warehouse stock
      INSERT INTO stock_levels (product_id, warehouse_id, quantity_on_hand)
      SELECT 
        sml.product_id,
        NEW.destination_warehouse_id,
        SUM(sml.quantity_processed)
      FROM stock_movement_lines sml
      WHERE sml.stock_movement_id = NEW.id
      GROUP BY sml.product_id
      ON CONFLICT (product_id, warehouse_id, location_id, product_variant_id) 
      DO UPDATE SET 
        quantity_on_hand = stock_levels.quantity_on_hand + EXCLUDED.quantity_on_hand,
        updated_at = NOW();
    END IF;
    
    IF NEW.movement_type IN ('delivery', 'internal_transfer', 'scrap') THEN
      -- Decrease source warehouse stock
      UPDATE stock_levels sl
      SET 
        quantity_on_hand = sl.quantity_on_hand - sml.quantity_sum,
        updated_at = NOW()
      FROM (
        SELECT product_id, SUM(quantity_processed) as quantity_sum
        FROM stock_movement_lines
        WHERE stock_movement_id = NEW.id
        GROUP BY product_id
      ) sml
      WHERE sl.product_id = sml.product_id 
        AND sl.warehouse_id = NEW.source_warehouse_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stock from movements
DROP TRIGGER IF EXISTS trg_update_stock_from_movement ON stock_movements;
CREATE TRIGGER trg_update_stock_from_movement
  AFTER UPDATE OF status
  ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_stock_from_movement();

-- Insert default units of measure (run once per organization)
-- Note: These should be inserted via API when organization is created
-- This is just a reference

COMMENT ON TABLE product_images IS 'Stores multiple images per product for better product presentation';
COMMENT ON TABLE product_suppliers IS 'Links products to their suppliers with pricing and lead time information';
COMMENT ON TABLE stock_alerts IS 'Automated alerts for low stock, expiry warnings, etc.';
COMMENT ON TABLE inventory_valuation_snapshots IS 'Historical snapshots of inventory value for financial reporting';
COMMENT ON TABLE barcode_scan_log IS 'Audit trail of all barcode scanning activities';
COMMENT ON TABLE product_kits IS 'Define products that are bundles of other products';

-- Grant permissions (adjust as needed for your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_erp_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_erp_user;

COMMENT ON VIEW v_stock_summary IS 'Comprehensive view of stock levels across all warehouses with valuation';
COMMENT ON VIEW v_reorder_suggestions IS 'Products that need to be reordered with supplier information';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Inventory module enhancements applied successfully!';
  RAISE NOTICE 'New tables created: product_images, product_suppliers, stock_alerts, inventory_valuation_snapshots, barcode_scan_log, product_kits';
  RAISE NOTICE 'Views created: v_stock_summary, v_reorder_suggestions';
  RAISE NOTICE 'Triggers created for automatic stock alerts and movement processing';
END $$;

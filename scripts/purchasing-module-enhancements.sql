-- ============================================
-- PURCHASING MODULE ENHANCEMENTS
-- Purchase Orders, Invoices, Goods Receipts
-- ============================================

-- Vendor Invoices (Bills from Suppliers)
CREATE TABLE IF NOT EXISTS vendor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'paid', 'cancelled', 'overdue')),
  currency_code VARCHAR(3) DEFAULT 'INR',
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  shipping_charges DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  created_by UUID NOT NULL,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_org ON vendor_invoices(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_supplier ON vendor_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_po ON vendor_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_status ON vendor_invoices(status);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_date ON vendor_invoices(invoice_date);

-- Vendor Invoice Lines
CREATE TABLE IF NOT EXISTS vendor_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_invoice_id UUID NOT NULL REFERENCES vendor_invoices(id) ON DELETE CASCADE,
  purchase_order_line_id UUID REFERENCES purchase_order_lines(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  description TEXT,
  quantity DECIMAL(15,2) NOT NULL,
  uom_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_invoice_lines_invoice ON vendor_invoice_lines(vendor_invoice_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoice_lines_product ON vendor_invoice_lines(product_id);

-- Goods Receipts (Receiving from PO)
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(100) NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  delivery_note_number VARCHAR(100),
  vehicle_number VARCHAR(50),
  driver_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'received', 'quality_check', 'accepted', 'rejected', 'partially_accepted')),
  notes TEXT,
  received_by UUID NOT NULL,
  quality_checked_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_org ON goods_receipts(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON goods_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_warehouse ON goods_receipts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_status ON goods_receipts(status);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_date ON goods_receipts(receipt_date);

-- Goods Receipt Lines
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id UUID NOT NULL REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  warehouse_location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  quantity_ordered DECIMAL(15,2) NOT NULL,
  quantity_received DECIMAL(15,2) NOT NULL,
  quantity_accepted DECIMAL(15,2) DEFAULT 0,
  quantity_rejected DECIMAL(15,2) DEFAULT 0,
  uom_id UUID REFERENCES units_of_measure(id),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_lines_receipt ON goods_receipt_lines(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_lines_po_line ON goods_receipt_lines(purchase_order_line_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_lines_product ON goods_receipt_lines(product_id);

-- Payment Terms Master (Optional)
CREATE TABLE IF NOT EXISTS payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50),
  days INTEGER NOT NULL DEFAULT 30,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, code)
);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Function to update stock levels from goods receipt
CREATE OR REPLACE FUNCTION fn_update_stock_from_goods_receipt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Update stock levels when goods receipt is accepted
    INSERT INTO stock_levels (
      product_id,
      product_variant_id,
      warehouse_id,
      location_id,
      quantity_on_hand,
      quantity_reserved,
      updated_at
    )
    SELECT 
      grl.product_id,
      grl.product_variant_id,
      gr.warehouse_id,
      grl.warehouse_location_id,
      grl.quantity_accepted,
      0,
      NOW()
    FROM goods_receipt_lines grl
    JOIN goods_receipts gr ON gr.id = grl.goods_receipt_id
    WHERE grl.goods_receipt_id = NEW.id
    ON CONFLICT (product_id, warehouse_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET
      quantity_on_hand = stock_levels.quantity_on_hand + EXCLUDED.quantity_on_hand,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock_from_goods_receipt ON goods_receipts;
CREATE TRIGGER trg_update_stock_from_goods_receipt
  AFTER INSERT OR UPDATE OF status
  ON goods_receipts
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_stock_from_goods_receipt();

-- Function to update PO line received quantities
CREATE OR REPLACE FUNCTION fn_update_po_received_qty()
RETURNS TRIGGER AS $$
BEGIN
  -- Update purchase order line with received quantity
  UPDATE purchase_order_lines pol
  SET quantity_received = COALESCE(pol.quantity_received, 0) + NEW.quantity_accepted
  WHERE pol.id = NEW.purchase_order_line_id;
  
  -- Update PO status based on all lines
  UPDATE purchase_orders po
  SET status = CASE
    WHEN (SELECT SUM(quantity_received) FROM purchase_order_lines WHERE purchase_order_id = po.id) >= 
         (SELECT SUM(quantity_ordered) FROM purchase_order_lines WHERE purchase_order_id = po.id)
    THEN 'received'
    WHEN (SELECT SUM(quantity_received) FROM purchase_order_lines WHERE purchase_order_id = po.id) > 0
    THEN 'partially_received'
    ELSE po.status
  END,
  updated_at = NOW()
  WHERE po.id = (SELECT purchase_order_id FROM purchase_order_lines WHERE id = NEW.purchase_order_line_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_po_received_qty ON goods_receipt_lines;
CREATE TRIGGER trg_update_po_received_qty
  AFTER INSERT OR UPDATE OF quantity_accepted
  ON goods_receipt_lines
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_po_received_qty();

-- Function to auto-calculate invoice totals
CREATE OR REPLACE FUNCTION fn_calculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(15,2);
  v_tax_amount DECIMAL(15,2);
BEGIN
  -- Calculate subtotal and tax from lines
  SELECT 
    COALESCE(SUM(line_total), 0),
    COALESCE(SUM(line_total * tax_rate / 100), 0)
  INTO v_subtotal, v_tax_amount
  FROM vendor_invoice_lines
  WHERE vendor_invoice_id = NEW.vendor_invoice_id;
  
  -- Update invoice header
  UPDATE vendor_invoices
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal + v_tax_amount + COALESCE(shipping_charges, 0) - COALESCE(discount_amount, 0),
    updated_at = NOW()
  WHERE id = NEW.vendor_invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_invoice_totals ON vendor_invoice_lines;
CREATE TRIGGER trg_calculate_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE
  ON vendor_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_invoice_totals();

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View: Purchase Order Summary with Supplier
CREATE OR REPLACE VIEW v_purchase_order_summary AS
SELECT 
  po.id,
  po.erp_organization_id,
  po.po_number,
  po.po_date,
  po.expected_delivery_date,
  po.status,
  po.total_amount,
  po.currency_code,
  s.name as supplier_name,
  s.code as supplier_code,
  w.name as warehouse_name,
  COUNT(pol.id) as line_count,
  SUM(pol.quantity_ordered) as total_qty_ordered,
  SUM(pol.quantity_received) as total_qty_received,
  po.created_at,
  po.updated_at
FROM purchase_orders po
LEFT JOIN suppliers s ON po.supplier_id = s.id
LEFT JOIN warehouses w ON po.warehouse_id = w.id
LEFT JOIN purchase_order_lines pol ON po.id = pol.purchase_order_id
GROUP BY po.id, s.name, s.code, w.name;

-- View: Pending Invoices
CREATE OR REPLACE VIEW v_pending_invoices AS
SELECT 
  vi.id,
  vi.erp_organization_id,
  vi.invoice_number,
  vi.invoice_date,
  vi.due_date,
  vi.total_amount,
  vi.amount_paid,
  vi.total_amount - vi.amount_paid as balance,
  CASE 
    WHEN vi.due_date < CURRENT_DATE THEN 'overdue'
    WHEN vi.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'pending'
  END as payment_status,
  s.name as supplier_name,
  po.po_number,
  vi.created_at
FROM vendor_invoices vi
LEFT JOIN suppliers s ON vi.supplier_id = s.id
LEFT JOIN purchase_orders po ON vi.purchase_order_id = po.id
WHERE vi.status NOT IN ('paid', 'cancelled');

-- View: Goods Receipt Summary
CREATE OR REPLACE VIEW v_goods_receipt_summary AS
SELECT 
  gr.id,
  gr.erp_organization_id,
  gr.receipt_number,
  gr.receipt_date,
  gr.status,
  gr.delivery_note_number,
  po.po_number,
  s.name as supplier_name,
  w.name as warehouse_name,
  COUNT(grl.id) as line_count,
  SUM(grl.quantity_received) as total_qty_received,
  SUM(grl.quantity_accepted) as total_qty_accepted,
  SUM(grl.quantity_rejected) as total_qty_rejected,
  gr.created_at
FROM goods_receipts gr
LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
LEFT JOIN suppliers s ON gr.supplier_id = s.id
LEFT JOIN warehouses w ON gr.warehouse_id = w.id
LEFT JOIN goods_receipt_lines grl ON gr.id = grl.goods_receipt_id
GROUP BY gr.id, po.po_number, s.name, w.name;

COMMENT ON TABLE vendor_invoices IS 'Supplier invoices/bills for purchases';
COMMENT ON TABLE goods_receipts IS 'Goods receipt notes for receiving inventory from purchase orders';
COMMENT ON VIEW v_purchase_order_summary IS 'Summary view of purchase orders with supplier and receipt status';
COMMENT ON VIEW v_pending_invoices IS 'Pending and overdue supplier invoices';
COMMENT ON VIEW v_goods_receipt_summary IS 'Summary of goods receipts with acceptance status';

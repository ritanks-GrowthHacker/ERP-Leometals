-- ============================================
-- RFQ (Request for Quotation) & QUOTATION MODULE
-- ============================================

-- Request for Quotations
CREATE TABLE IF NOT EXISTS request_for_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  rfq_number VARCHAR(100) NOT NULL,
  rfq_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline_date DATE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'in_progress', 'received', 'closed', 'cancelled')),
  currency_code VARCHAR(3) DEFAULT 'INR',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, rfq_number)
);

CREATE INDEX IF NOT EXISTS idx_rfq_org ON request_for_quotations(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_rfq_status ON request_for_quotations(status);
CREATE INDEX IF NOT EXISTS idx_rfq_date ON request_for_quotations(rfq_date);

-- RFQ Lines (Items requested)
CREATE TABLE IF NOT EXISTS rfq_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES request_for_quotations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  description TEXT,
  quantity_requested DECIMAL(15,2) NOT NULL,
  uom_id UUID REFERENCES units_of_measure(id),
  target_price DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_lines_rfq ON rfq_lines(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_lines_product ON rfq_lines(product_id);

-- RFQ Suppliers (Suppliers invited to quote)
CREATE TABLE IF NOT EXISTS rfq_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES request_for_quotations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invited_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded BOOLEAN DEFAULT false,
  response_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(rfq_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_suppliers_rfq ON rfq_suppliers(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_suppliers_supplier ON rfq_suppliers(supplier_id);

-- Supplier Quotations (Responses to RFQ)
CREATE TABLE IF NOT EXISTS supplier_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  rfq_id UUID REFERENCES request_for_quotations(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  quotation_number VARCHAR(100) NOT NULL,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'accepted', 'rejected', 'expired')),
  currency_code VARCHAR(3) DEFAULT 'INR',
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  shipping_charges DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  payment_terms INTEGER DEFAULT 30,
  delivery_time INTEGER, -- days
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, quotation_number)
);

CREATE INDEX IF NOT EXISTS idx_quotations_org ON supplier_quotations(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_quotations_rfq ON supplier_quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotations_supplier ON supplier_quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON supplier_quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON supplier_quotations(quotation_date);

-- Quotation Lines
CREATE TABLE IF NOT EXISTS quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES supplier_quotations(id) ON DELETE CASCADE,
  rfq_line_id UUID REFERENCES rfq_lines(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  description TEXT,
  quantity DECIMAL(15,2) NOT NULL,
  uom_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  delivery_time INTEGER, -- days for this specific item
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_lines_quotation ON quotation_lines(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_product ON quotation_lines(product_id);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Function to auto-calculate quotation totals
CREATE OR REPLACE FUNCTION fn_calculate_quotation_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(15,2);
  v_tax_amount DECIMAL(15,2);
BEGIN
  -- Calculate subtotal and tax from lines
  SELECT 
    COALESCE(SUM(line_total / (1 + tax_rate / 100)), 0),
    COALESCE(SUM(line_total - (line_total / (1 + tax_rate / 100))), 0)
  INTO v_subtotal, v_tax_amount
  FROM quotation_lines
  WHERE quotation_id = NEW.quotation_id;
  
  -- Update quotation header
  UPDATE supplier_quotations
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal + v_tax_amount + COALESCE(shipping_charges, 0) - COALESCE(discount_amount, 0),
    updated_at = NOW()
  WHERE id = NEW.quotation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_quotation_totals ON quotation_lines;
CREATE TRIGGER trg_calculate_quotation_totals
  AFTER INSERT OR UPDATE OR DELETE
  ON quotation_lines
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_quotation_totals();

-- Function to mark RFQ supplier as responded when quotation submitted
CREATE OR REPLACE FUNCTION fn_mark_rfq_supplier_responded()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') AND NEW.rfq_id IS NOT NULL THEN
    UPDATE rfq_suppliers
    SET 
      responded = true,
      response_date = NOW()
    WHERE rfq_id = NEW.rfq_id AND supplier_id = NEW.supplier_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mark_rfq_supplier_responded ON supplier_quotations;
CREATE TRIGGER trg_mark_rfq_supplier_responded
  AFTER INSERT OR UPDATE OF status
  ON supplier_quotations
  FOR EACH ROW
  EXECUTE FUNCTION fn_mark_rfq_supplier_responded();

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View: RFQ Summary with Supplier Responses
CREATE OR REPLACE VIEW v_rfq_summary AS
SELECT 
  rfq.id,
  rfq.erp_organization_id,
  rfq.rfq_number,
  rfq.rfq_date,
  rfq.deadline_date,
  rfq.title,
  rfq.status,
  COUNT(DISTINCT rs.supplier_id) as suppliers_invited,
  COUNT(DISTINCT CASE WHEN rs.responded = true THEN rs.supplier_id END) as suppliers_responded,
  COUNT(DISTINCT ql.id) as total_quotations_received,
  rfq.created_at
FROM request_for_quotations rfq
LEFT JOIN rfq_suppliers rs ON rfq.id = rs.rfq_id
LEFT JOIN supplier_quotations ql ON rfq.id = ql.rfq_id AND ql.status IN ('submitted', 'under_review', 'accepted')
GROUP BY rfq.id;

-- View: Quotation Comparison
CREATE OR REPLACE VIEW v_quotation_comparison AS
SELECT 
  sq.id as quotation_id,
  sq.rfq_id,
  sq.quotation_number,
  sq.quotation_date,
  sq.valid_until,
  sq.status,
  sq.total_amount,
  sq.delivery_time,
  sq.payment_terms,
  s.id as supplier_id,
  s.name as supplier_name,
  s.code as supplier_code,
  COUNT(ql.id) as line_count,
  rfq.rfq_number,
  rfq.title as rfq_title
FROM supplier_quotations sq
LEFT JOIN suppliers s ON sq.supplier_id = s.id
LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
LEFT JOIN quotation_lines ql ON sq.id = ql.quotation_id
GROUP BY sq.id, s.id, s.name, s.code, rfq.rfq_number, rfq.title;

COMMENT ON TABLE request_for_quotations IS 'Request for quotations sent to suppliers';
COMMENT ON TABLE supplier_quotations IS 'Quotations received from suppliers';
COMMENT ON VIEW v_rfq_summary IS 'Summary of RFQs with supplier response statistics';
COMMENT ON VIEW v_quotation_comparison IS 'Comparison view for evaluating supplier quotations';

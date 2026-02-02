-- Supplier Invoice Receipts System
-- This creates a receipts system for supplier portal invoices

-- Create supplier_invoice_receipts table
CREATE TABLE IF NOT EXISTS supplier_invoice_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  
  -- Receipt details
  receipt_date TIMESTAMP NOT NULL DEFAULT NOW(),
  amount DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  
  -- Additional information
  notes TEXT,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'acknowledged', 'downloaded')),
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Download tracking
  downloaded_at TIMESTAMP,
  downloaded_by UUID
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_receipts_supplier_id ON supplier_invoice_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_receipts_invoice_id ON supplier_invoice_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_receipts_erp_org_id ON supplier_invoice_receipts(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_receipts_receipt_date ON supplier_invoice_receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_receipts_status ON supplier_invoice_receipts(status);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_supplier_invoice_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supplier_invoice_receipts_updated_at
  BEFORE UPDATE ON supplier_invoice_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_invoice_receipts_updated_at();

-- Add constraint to ensure one receipt per invoice (optional, remove if multiple receipts needed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_invoice_receipts_unique_invoice 
  ON supplier_invoice_receipts(invoice_id);

-- Generate receipt number sequence function
CREATE OR REPLACE FUNCTION generate_receipt_number(org_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  receipt_count INTEGER;
  new_receipt_number VARCHAR(50);
BEGIN
  SELECT COUNT(*) INTO receipt_count 
  FROM supplier_invoice_receipts 
  WHERE erp_organization_id = org_id;
  
  new_receipt_number := 'RCP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((receipt_count + 1)::TEXT, 6, '0');
  
  RETURN new_receipt_number;
END;
$$ LANGUAGE plpgsql;

-- Sample query to verify installation
-- SELECT * FROM supplier_invoice_receipts LIMIT 5;

-- Query to check receipts with invoice details
-- SELECT 
--   r.receipt_number,
--   r.receipt_date,
--   r.amount,
--   r.status,
--   si.invoice_number,
--   si.total_amount as invoice_amount,
--   s.name as supplier_name
-- FROM supplier_invoice_receipts r
-- JOIN supplier_invoices si ON r.invoice_id = si.id
-- JOIN suppliers s ON r.supplier_id = s.id
-- ORDER BY r.receipt_date DESC;

COMMENT ON TABLE supplier_invoice_receipts IS 'Stores receipts generated for paid supplier invoices';
COMMENT ON COLUMN supplier_invoice_receipts.receipt_number IS 'Unique receipt number in format RCP-YYYY-XXXXXX';
COMMENT ON COLUMN supplier_invoice_receipts.status IS 'Receipt status: generated, sent, acknowledged, downloaded';

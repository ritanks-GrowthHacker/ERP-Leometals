-- PO Goods Receipts System
-- This creates a separate receipt tracking system for purchase orders
-- that allows generating receipts from POs and attaching them to suppliers

-- Main PO Goods Receipts Table
CREATE TABLE IF NOT EXISTS po_goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(100) NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received', 'completed', 'cancelled')),
  supplier_attached BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, receipt_number)
);

-- PO Goods Receipt Lines
CREATE TABLE IF NOT EXISTS po_goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_goods_receipt_id UUID NOT NULL REFERENCES po_goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id UUID NOT NULL REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_ordered DECIMAL(15,2) NOT NULL,
  quantity_pending DECIMAL(15,2) NOT NULL,
  quantity_received DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_po_goods_receipts_org ON po_goods_receipts(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_po_goods_receipts_po ON po_goods_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_goods_receipts_supplier ON po_goods_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_goods_receipts_warehouse ON po_goods_receipts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_po_goods_receipts_status ON po_goods_receipts(status);
CREATE INDEX IF NOT EXISTS idx_po_goods_receipts_date ON po_goods_receipts(receipt_date);

CREATE INDEX IF NOT EXISTS idx_po_goods_receipt_lines_receipt ON po_goods_receipt_lines(po_goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_po_goods_receipt_lines_po_line ON po_goods_receipt_lines(purchase_order_line_id);
CREATE INDEX IF NOT EXISTS idx_po_goods_receipt_lines_product ON po_goods_receipt_lines(product_id);

-- Comments
COMMENT ON TABLE po_goods_receipts IS 'PO-specific goods receipt tracking system for managing purchase order receipts and supplier attachments';
COMMENT ON COLUMN po_goods_receipts.supplier_attached IS 'Indicates if the receipt has been sent/attached to the supplier';
COMMENT ON COLUMN po_goods_receipts.status IS 'Receipt lifecycle: pending (created) -> sent (attached to supplier) -> received (goods received) -> completed';

COMMENT ON TABLE po_goods_receipt_lines IS 'Line items for PO goods receipts tracking ordered, pending, and received quantities';
COMMENT ON COLUMN po_goods_receipt_lines.quantity_pending IS 'Quantity yet to be received = quantity_ordered - previously_received';
COMMENT ON COLUMN po_goods_receipt_lines.quantity_received IS 'Quantity received in this specific receipt';

-- Add Sales Quotations and Sales Invoices tables to the database

-- Sales Quotations
CREATE TABLE IF NOT EXISTS sales_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quotation_number VARCHAR(100) NOT NULL,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status VARCHAR(50) DEFAULT 'draft',
  currency_code VARCHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_quotations_org ON sales_quotations(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotations_customer ON sales_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotations_status ON sales_quotations(status);
CREATE INDEX IF NOT EXISTS idx_sales_quotations_date ON sales_quotations(quotation_date);

-- Sales Quotation Lines
CREATE TABLE IF NOT EXISTS sales_quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_quotation_id UUID NOT NULL REFERENCES sales_quotations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  description TEXT,
  quantity DECIMAL(15, 2) NOT NULL,
  uom_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  discount DECIMAL(5, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_quotation_lines_quotation ON sales_quotation_lines(sales_quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotation_lines_product ON sales_quotation_lines(product_id);

-- Sales Invoices
CREATE TABLE IF NOT EXISTS sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'draft',
  currency_code VARCHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  paid_amount DECIMAL(15, 2) DEFAULT 0,
  balance_amount DECIMAL(15, 2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_invoices_org ON sales_invoices(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_order ON sales_invoices(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date);

-- Sales Invoice Lines
CREATE TABLE IF NOT EXISTS sales_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  description TEXT,
  quantity DECIMAL(15, 2) NOT NULL,
  uom_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  discount DECIMAL(5, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_lines_invoice ON sales_invoice_lines(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_lines_product ON sales_invoice_lines(product_id);

COMMENT ON TABLE sales_quotations IS 'Sales quotations/proposals sent to customers';
COMMENT ON TABLE sales_quotation_lines IS 'Line items for sales quotations';
COMMENT ON TABLE sales_invoices IS 'Sales invoices issued to customers';
COMMENT ON TABLE sales_invoice_lines IS 'Line items for sales invoices';

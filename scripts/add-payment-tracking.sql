-- Add payment tracking columns to sales_invoices table
ALTER TABLE sales_invoices 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

-- Create sales_invoice_payments table for tracking multiple payments
CREATE TABLE IF NOT EXISTS sales_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
  amount DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  reference_number VARCHAR(255),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_invoice_payments_invoice_id 
ON sales_invoice_payments(sales_invoice_id);

-- Add the same columns to supplier_invoices for consistency
ALTER TABLE supplier_invoices 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

-- Create supplier_invoice_payments table
CREATE TABLE IF NOT EXISTS supplier_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
  amount DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  reference_number VARCHAR(255),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_payments_invoice_id 
ON supplier_invoice_payments(supplier_invoice_id);

-- =====================================================
-- FIX SUPPLIER INVOICES - ADD PAYMENT_TERMS COLUMN
-- Date: 2025-12-25
-- Description: Add missing payment_terms column to supplier_invoices table
-- =====================================================

-- Add payment_terms column if it doesn't exist
ALTER TABLE supplier_invoices 
ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'net_30';

-- Update existing records to have payment_terms based on notes column if present
UPDATE supplier_invoices 
SET payment_terms = 
  CASE 
    WHEN notes LIKE '%net_30%' OR notes LIKE '%30%' THEN 'net_30'
    WHEN notes LIKE '%net_15%' OR notes LIKE '%15%' THEN 'net_15'
    WHEN notes LIKE '%net_7%' OR notes LIKE '%7%' THEN 'net_7'
    ELSE 'net_30'
  END
WHERE payment_terms IS NULL;

-- Add comment
COMMENT ON COLUMN supplier_invoices.payment_terms IS 'Payment terms: net_7, net_15, net_30, due_on_receipt, advance';

-- Display success message
SELECT 'Payment terms column added successfully to supplier_invoices table' as status;

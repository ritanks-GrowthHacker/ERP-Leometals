-- Migration: Add Supplier Portal Features
-- Date: 2025-12-25
-- Description: Adds OTP authentication, profile image, and quotation submission system for suppliers

-- 1. Add new columns to suppliers table
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS profile_image TEXT,
ADD COLUMN IF NOT EXISTS otp VARCHAR(10),
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN suppliers.profile_image IS 'Base64 encoded profile image or URL';
COMMENT ON COLUMN suppliers.otp IS 'One-time password for supplier portal authentication';
COMMENT ON COLUMN suppliers.otp_expires_at IS 'Expiration timestamp for OTP (typically 10 minutes)';
COMMENT ON COLUMN suppliers.last_login_at IS 'Last successful login timestamp for supplier portal';

-- 2. Create supplier_quotation_submissions table
CREATE TABLE IF NOT EXISTS supplier_quotation_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID REFERENCES request_for_quotations(id) ON DELETE SET NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    submission_number VARCHAR(100) NOT NULL UNIQUE,
    submission_date TIMESTAMPTZ DEFAULT NOW(),
    submission_type VARCHAR(20) DEFAULT 'quotation', -- quotation, revised_quotation
    quotation_type VARCHAR(20) NOT NULL, -- file_upload, manual_entry
    
    -- For file uploads
    file_url TEXT,
    file_name VARCHAR(255),
    file_type VARCHAR(50), -- pdf, docx, jpg, png, etc.
    file_size INTEGER, -- in bytes
    
    -- For manual entry
    manual_quotation_data JSONB, -- { items: [{product, qty, price, tax}], notes, terms }
    
    -- Common fields
    total_amount DECIMAL(15, 2),
    currency_code VARCHAR(3) DEFAULT 'INR',
    valid_until DATE,
    delivery_time_in_days INTEGER,
    payment_terms TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'submitted', -- submitted, under_review, accepted, rejected
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplier_quotation_submissions_supplier_id 
ON supplier_quotation_submissions(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_quotation_submissions_rfq_id 
ON supplier_quotation_submissions(rfq_id);

CREATE INDEX IF NOT EXISTS idx_supplier_quotation_submissions_po_id 
ON supplier_quotation_submissions(purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_supplier_quotation_submissions_status 
ON supplier_quotation_submissions(status);

CREATE INDEX IF NOT EXISTS idx_supplier_quotation_submissions_submission_date 
ON supplier_quotation_submissions(submission_date DESC);

-- Add comments
COMMENT ON TABLE supplier_quotation_submissions IS 'Stores quotations submitted by suppliers through the supplier portal';
COMMENT ON COLUMN supplier_quotation_submissions.submission_number IS 'Unique submission number (e.g., SQ000001)';
COMMENT ON COLUMN supplier_quotation_submissions.quotation_type IS 'Type: file_upload (PDF/Word/Image) or manual_entry';
COMMENT ON COLUMN supplier_quotation_submissions.file_url IS 'Base64 encoded file data or storage URL';
COMMENT ON COLUMN supplier_quotation_submissions.manual_quotation_data IS 'JSON data for manually entered quotations';

-- Create function to auto-generate submission numbers
CREATE OR REPLACE FUNCTION generate_submission_number()
RETURNS TRIGGER AS $$
DECLARE
    last_number INTEGER;
    new_number VARCHAR(100);
BEGIN
    -- Get the last submission number
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(submission_number FROM 3) AS INTEGER)), 
        0
    ) INTO last_number
    FROM supplier_quotation_submissions
    WHERE submission_number ~ '^SQ[0-9]+$';
    
    -- Generate new number
    new_number := 'SQ' || LPAD((last_number + 1)::TEXT, 6, '0');
    NEW.submission_number := new_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating submission numbers
DROP TRIGGER IF EXISTS trigger_generate_submission_number ON supplier_quotation_submissions;
CREATE TRIGGER trigger_generate_submission_number
BEFORE INSERT ON supplier_quotation_submissions
FOR EACH ROW
WHEN (NEW.submission_number IS NULL OR NEW.submission_number = '')
EXECUTE FUNCTION generate_submission_number();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_supplier_quotation_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_supplier_quotation_submissions_timestamp ON supplier_quotation_submissions;
CREATE TRIGGER trigger_update_supplier_quotation_submissions_timestamp
BEFORE UPDATE ON supplier_quotation_submissions
FOR EACH ROW
EXECUTE FUNCTION update_supplier_quotation_submissions_updated_at();

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON supplier_quotation_submissions TO your_app_user;
-- GRANT USAGE ON SEQUENCE supplier_quotation_submissions_id_seq TO your_app_user;

-- Verification queries
-- Check if columns were added successfully
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'suppliers' 
AND column_name IN ('profile_image', 'otp', 'otp_expires_at', 'last_login_at');

-- Check if table was created successfully
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'supplier_quotation_submissions';

-- Verify indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'supplier_quotation_submissions';

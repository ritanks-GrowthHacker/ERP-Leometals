-- =====================================================
-- SUPPLIER PORTAL COMPLETE SYSTEM - SQL SCRIPT
-- Date: 2025-12-25
-- Description: Complete supplier-customer workflow system
-- =====================================================

-- =====================================================
-- 1. INVOICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    quotation_id UUID REFERENCES supplier_quotation_submissions(id) ON DELETE SET NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    
    -- Invoice Details
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    shipping_charges DECIMAL(15, 2) DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'INR',
    
    -- Payment Details
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, partially_paid, paid, overdue
    payment_method VARCHAR(50), -- online, bank_transfer, check, cash, upi
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    payment_date DATE,
    payment_reference VARCHAR(255),
    payment_notes TEXT,
    
    -- Supplier Actions
    payment_marked_received BOOLEAN DEFAULT false,
    payment_marked_at TIMESTAMPTZ,
    
    -- Files
    invoice_file_url TEXT, -- Base64 or storage URL
    invoice_file_name VARCHAR(255),
    payment_proof_url TEXT, -- Base64 or storage URL
    payment_proof_name VARCHAR(255),
    
    notes TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, viewed, paid, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- =====================================================
-- 2. QUOTATION REJECTION NOTES
-- =====================================================
ALTER TABLE supplier_quotation_submissions
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_notes TEXT,
ADD COLUMN IF NOT EXISTS can_resubmit BOOLEAN DEFAULT true;

-- =====================================================
-- 3. MEETINGS/CALLS SCHEDULING
-- =====================================================
CREATE TABLE IF NOT EXISTS supplier_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    quotation_id UUID REFERENCES supplier_quotation_submissions(id) ON DELETE SET NULL,
    
    -- Meeting Details
    meeting_type VARCHAR(50) NOT NULL, -- call, video_call, in_person
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    location TEXT, -- For in-person or meeting link for video calls
    
    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled, rescheduled
    requested_by VARCHAR(50) NOT NULL, -- supplier, customer
    confirmed_by_supplier BOOLEAN DEFAULT false,
    confirmed_by_customer BOOLEAN DEFAULT false,
    
    -- Participants
    customer_contact_name VARCHAR(255),
    customer_contact_email VARCHAR(255),
    customer_contact_phone VARCHAR(50),
    supplier_contact_name VARCHAR(255),
    supplier_contact_email VARCHAR(255),
    supplier_contact_phone VARCHAR(50),
    
    -- Notes
    meeting_notes TEXT,
    cancellation_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- =====================================================
-- 4. SUPPLIER RATINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS supplier_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE SET NULL,
    
    -- Ratings (1-5 scale)
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    delivery_rating INTEGER CHECK (delivery_rating BETWEEN 1 AND 5),
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    pricing_rating INTEGER CHECK (pricing_rating BETWEEN 1 AND 5),
    overall_rating DECIMAL(3, 2), -- Auto-calculated average
    
    -- Feedback
    review_title VARCHAR(255),
    review_text TEXT,
    would_recommend BOOLEAN,
    
    -- Metadata
    rated_by UUID NOT NULL,
    rated_at TIMESTAMPTZ DEFAULT NOW(),
    is_public BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. PAYMENT TRANSACTIONS LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS supplier_payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
    
    -- Transaction Details
    transaction_number VARCHAR(100) NOT NULL UNIQUE,
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- online, bank_transfer, check, cash, upi
    
    -- Payment Details
    transaction_reference VARCHAR(255), -- Bank ref, UPI ID, Check number
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    ifsc_code VARCHAR(50),
    upi_id VARCHAR(255),
    check_number VARCHAR(100),
    check_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, refunded
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- =====================================================
-- 6. NOTIFICATIONS/ACTIVITY LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS supplier_portal_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    
    -- Notification Details
    notification_type VARCHAR(100) NOT NULL, -- quotation_accepted, quotation_rejected, meeting_scheduled, payment_received, etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related Entities
    related_entity_type VARCHAR(50), -- quotation, invoice, meeting, payment
    related_entity_id UUID,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Invoices
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_quotation_id ON supplier_invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_payment_status ON supplier_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_due_date ON supplier_invoices(due_date);

-- Meetings
CREATE INDEX IF NOT EXISTS idx_supplier_meetings_supplier_id ON supplier_meetings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_meetings_scheduled_date ON supplier_meetings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_supplier_meetings_status ON supplier_meetings(status);

-- Ratings
CREATE INDEX IF NOT EXISTS idx_supplier_ratings_supplier_id ON supplier_ratings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ratings_overall ON supplier_ratings(overall_rating DESC);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON supplier_payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON supplier_payment_transactions(status);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_supplier_id ON supplier_portal_notifications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON supplier_portal_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON supplier_portal_notifications(created_at DESC);

-- =====================================================
-- AUTO-GENERATE FUNCTIONS
-- =====================================================

-- Invoice Number Generator
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    last_number INTEGER;
    new_number VARCHAR(100);
BEGIN
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(invoice_number FROM 4) AS INTEGER)), 
        0
    ) INTO last_number
    FROM supplier_invoices
    WHERE invoice_number ~ '^INV[0-9]+$';
    
    new_number := 'INV' || LPAD((last_number + 1)::TEXT, 6, '0');
    NEW.invoice_number := new_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Transaction Number Generator
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TRIGGER AS $$
DECLARE
    last_number INTEGER;
    new_number VARCHAR(100);
BEGIN
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(transaction_number FROM 4) AS INTEGER)), 
        0
    ) INTO last_number
    FROM supplier_payment_transactions
    WHERE transaction_number ~ '^TXN[0-9]+$';
    
    new_number := 'TXN' || LPAD((last_number + 1)::TEXT, 8, '0');
    NEW.transaction_number := new_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-calculate Overall Rating
CREATE OR REPLACE FUNCTION calculate_overall_rating()
RETURNS TRIGGER AS $$
BEGIN
    NEW.overall_rating := (
        COALESCE(NEW.quality_rating, 0) + 
        COALESCE(NEW.delivery_rating, 0) + 
        COALESCE(NEW.communication_rating, 0) + 
        COALESCE(NEW.pricing_rating, 0)
    )::DECIMAL / 4.0;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Invoice Number
DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON supplier_invoices;
CREATE TRIGGER trigger_generate_invoice_number
    BEFORE INSERT ON supplier_invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
    EXECUTE FUNCTION generate_invoice_number();

-- Transaction Number
DROP TRIGGER IF EXISTS trigger_generate_transaction_number ON supplier_payment_transactions;
CREATE TRIGGER trigger_generate_transaction_number
    BEFORE INSERT ON supplier_payment_transactions
    FOR EACH ROW
    WHEN (NEW.transaction_number IS NULL OR NEW.transaction_number = '')
    EXECUTE FUNCTION generate_transaction_number();

-- Overall Rating
DROP TRIGGER IF EXISTS trigger_calculate_overall_rating ON supplier_ratings;
CREATE TRIGGER trigger_calculate_overall_rating
    BEFORE INSERT OR UPDATE ON supplier_ratings
    FOR EACH ROW
    EXECUTE FUNCTION calculate_overall_rating();

-- =====================================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =====================================================

-- Add comments for documentation
COMMENT ON TABLE supplier_invoices IS 'Invoices created by suppliers for accepted quotations';
COMMENT ON TABLE supplier_meetings IS 'Scheduled meetings/calls between suppliers and customers';
COMMENT ON TABLE supplier_ratings IS 'Customer ratings and reviews for suppliers';
COMMENT ON TABLE supplier_payment_transactions IS 'Payment transaction log for invoices';
COMMENT ON TABLE supplier_portal_notifications IS 'Notification system for supplier portal activities';

COMMENT ON COLUMN supplier_invoices.payment_marked_received IS 'Supplier confirms payment received';
COMMENT ON COLUMN supplier_meetings.requested_by IS 'Who requested the meeting - supplier or customer';
COMMENT ON COLUMN supplier_ratings.overall_rating IS 'Auto-calculated average of all ratings';

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- Supplier Performance View
CREATE OR REPLACE VIEW supplier_performance_summary AS
SELECT 
    s.id AS supplier_id,
    s.name AS supplier_name,
    s.code AS supplier_code,
    COUNT(DISTINCT sq.id) AS total_quotations,
    COUNT(DISTINCT CASE WHEN sq.status = 'accepted' THEN sq.id END) AS accepted_quotations,
    COUNT(DISTINCT CASE WHEN sq.status = 'rejected' THEN sq.id END) AS rejected_quotations,
    COUNT(DISTINCT si.id) AS total_invoices,
    SUM(si.total_amount) AS total_invoice_amount,
    COUNT(DISTINCT CASE WHEN si.payment_status = 'paid' THEN si.id END) AS paid_invoices,
    AVG(sr.overall_rating) AS average_rating,
    COUNT(sr.id) AS total_ratings
FROM suppliers s
LEFT JOIN supplier_quotation_submissions sq ON s.id = sq.supplier_id
LEFT JOIN supplier_invoices si ON s.id = si.supplier_id
LEFT JOIN supplier_ratings sr ON s.id = sr.supplier_id
GROUP BY s.id, s.name, s.code;

-- Pending Payments View
CREATE OR REPLACE VIEW pending_supplier_payments AS
SELECT 
    si.id AS invoice_id,
    si.invoice_number,
    s.name AS supplier_name,
    s.email AS supplier_email,
    si.total_amount,
    si.paid_amount,
    (si.total_amount - si.paid_amount) AS outstanding_amount,
    si.due_date,
    CASE 
        WHEN si.due_date < CURRENT_DATE THEN 'overdue'
        WHEN si.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
        ELSE 'upcoming'
    END AS urgency,
    si.payment_method,
    si.created_at
FROM supplier_invoices si
JOIN suppliers s ON si.supplier_id = s.id
WHERE si.payment_status IN ('pending', 'partially_paid')
ORDER BY si.due_date ASC;

-- =====================================================
-- COMPLETED - RUN THIS ENTIRE SCRIPT IN PGADMIN
-- =====================================================

-- =====================================================
-- DELIVERY MODULE SYSTEM - SQL SCRIPT
-- Date: 2025-12-26
-- Description: Delivery partner assignment and tracking system for sales orders
-- =====================================================

-- =====================================================
-- 1. DELIVERY ASSIGNMENTS TABLE
-- =====================================================
-- Stores delivery partner assignments for sales orders (one-to-one relationship)
CREATE TABLE IF NOT EXISTS delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE UNIQUE, -- One delivery per order
    
    -- Delivery Partner Details
    delivery_partner_name VARCHAR(255) NOT NULL,
    delivery_partner_mobile VARCHAR(50) NOT NULL,
    delivery_partner_email VARCHAR(255) NOT NULL,
    
    -- Addresses
    pickup_address TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    
    -- Receiver Details
    receiver_mobile VARCHAR(50) NOT NULL,
    receiver_email VARCHAR(255) NOT NULL,
    
    -- OTP for delivery verification
    delivery_otp VARCHAR(10) NOT NULL,
    otp_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    otp_expires_at TIMESTAMPTZ NOT NULL, -- OTP valid for 24 hours
    otp_verified_at TIMESTAMPTZ,
    
    -- Delivery Link Token (JWT-like token for delivery partner)
    delivery_token VARCHAR(500) NOT NULL UNIQUE,
    token_expires_at TIMESTAMPTZ NOT NULL, -- Token expires after 7 days or on delivery
    token_used BOOLEAN DEFAULT false, -- Once delivered, token is marked as used
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, picked_up, delivered, cancelled
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    -- Notes
    delivery_notes TEXT,
    special_instructions TEXT,
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'picked_up', 'delivered', 'cancelled'))
);

-- =====================================================
-- 2. DELIVERY STATUS LOGS TABLE
-- =====================================================
-- Track all status changes for audit trail
CREATE TABLE IF NOT EXISTS delivery_status_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_assignment_id UUID NOT NULL REFERENCES delivery_assignments(id) ON DELETE CASCADE,
    
    -- Status Change
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by VARCHAR(100), -- 'delivery_partner', 'erp_user', 'system'
    
    -- Location (optional, for future GPS tracking)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    notes TEXT
);

-- =====================================================
-- 3. UPDATE SALES ORDERS TABLE
-- =====================================================
-- Add delivery-related columns to sales_orders if not exists
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, picked_up, in_transit, delivered
ADD COLUMN IF NOT EXISTS delivery_assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_picked_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_delivered_at TIMESTAMPTZ;

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_org ON delivery_assignments(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_sales_order ON delivery_assignments(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(status);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_token ON delivery_assignments(delivery_token);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_email ON delivery_assignments(delivery_partner_email);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_assignment ON delivery_status_logs(delivery_assignment_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_changed_at ON delivery_status_logs(changed_at);

CREATE INDEX IF NOT EXISTS idx_sales_orders_delivery_status ON sales_orders(delivery_status);

-- =====================================================
-- 5. TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_delivery_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_delivery_assignments_updated_at ON delivery_assignments;
CREATE TRIGGER trigger_update_delivery_assignments_updated_at
    BEFORE UPDATE ON delivery_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_assignments_updated_at();

-- =====================================================
-- 6. FUNCTION TO AUTO-EXPIRE TOKENS
-- =====================================================
-- This can be called periodically to mark expired tokens
CREATE OR REPLACE FUNCTION expire_delivery_tokens()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE delivery_assignments
    SET token_used = true
    WHERE token_expires_at < NOW()
      AND token_used = false
      AND status != 'delivered';
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE delivery_assignments IS 'Stores delivery partner assignments for sales orders with one-to-one relationship';
COMMENT ON COLUMN delivery_assignments.delivery_token IS 'Unique token sent to delivery partner for accessing delivery portal';
COMMENT ON COLUMN delivery_assignments.token_used IS 'Marks token as used after delivery is completed - prevents reuse';
COMMENT ON COLUMN delivery_assignments.delivery_otp IS 'OTP sent to receiver for verification at delivery time';
COMMENT ON COLUMN delivery_assignments.status IS 'Current delivery status: pending (assigned), picked_up (collected from warehouse), delivered (completed)';

COMMENT ON TABLE delivery_status_logs IS 'Audit trail for all delivery status changes';

-- =====================================================
-- END OF SCRIPT
-- =====================================================

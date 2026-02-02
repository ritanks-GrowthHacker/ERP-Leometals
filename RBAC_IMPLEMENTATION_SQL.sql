-- ============================================
-- RBAC IMPLEMENTATION - DATABASE SCHEMA
-- ============================================

-- Add role field to erpUserAccess if not exists
ALTER TABLE erp_user_access 
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS warehouse_location_id UUID REFERENCES warehouse_locations(id) ON DELETE CASCADE;

-- Create warehouse_manager_otp table for OTP authentication
CREATE TABLE IF NOT EXISTS warehouse_manager_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  warehouse_location_id UUID REFERENCES warehouse_locations(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_warehouse_manager_otp_email ON warehouse_manager_otp(email);
CREATE INDEX IF NOT EXISTS idx_warehouse_manager_otp_expires ON warehouse_manager_otp(expires_at);

-- Add manager_type to warehouse_managers to distinguish roles
ALTER TABLE warehouse_managers 
ADD COLUMN IF NOT EXISTS manager_type VARCHAR(50) DEFAULT 'warehouse_manager';

-- Add manager_type to warehouse_locations
ALTER TABLE warehouse_locations 
ADD COLUMN IF NOT EXISTS manager_type VARCHAR(50) DEFAULT 'location_manager';

-- Comments
COMMENT ON TABLE warehouse_manager_otp IS 'Stores OTP for warehouse manager authentication';
COMMENT ON COLUMN warehouse_manager_otp.otp IS '6-digit OTP code';
COMMENT ON COLUMN warehouse_manager_otp.expires_at IS 'OTP expiration time (5 minutes from creation)';
COMMENT ON COLUMN warehouse_manager_otp.is_used IS 'Whether the OTP has been used';

-- Function to clean up expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM warehouse_manager_otp 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

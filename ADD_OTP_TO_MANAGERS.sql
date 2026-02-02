-- ============================================
-- ADD OTP COLUMNS TO MANAGER TABLES
-- ============================================

-- Add OTP columns to warehouse_managers table
ALTER TABLE warehouse_managers 
ADD COLUMN IF NOT EXISTS otp VARCHAR(6),
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add OTP columns to warehouse_locations table
ALTER TABLE warehouse_locations 
ADD COLUMN IF NOT EXISTS otp VARCHAR(6),
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Comments
COMMENT ON COLUMN warehouse_managers.otp IS '6-digit OTP for warehouse manager login';
COMMENT ON COLUMN warehouse_managers.otp_expires_at IS 'OTP expiration timestamp (5 minutes from generation)';
COMMENT ON COLUMN warehouse_managers.last_login_at IS 'Last login timestamp';

COMMENT ON COLUMN warehouse_locations.otp IS '6-digit OTP for location manager login';
COMMENT ON COLUMN warehouse_locations.otp_expires_at IS 'OTP expiration timestamp (5 minutes from generation)';
COMMENT ON COLUMN warehouse_locations.last_login_at IS 'Last login timestamp';

-- Success message
SELECT 'OTP columns added to warehouse_managers and warehouse_locations tables successfully.' AS status;

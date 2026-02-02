-- ==========================================
-- API Integration Setup SQL
-- Run this in PGAdmin on erp_sales database
-- ==========================================

-- 1. Fix existing api_keys table constraints
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_sub_organisation_id_fkey;
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE api_keys ALTER COLUMN sub_organisation_id DROP NOT NULL;
ALTER TABLE api_keys ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add company details to api_keys table
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS company_email VARCHAR(255);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS company_phone VARCHAR(50);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);

-- 3. Create api_users table for API authentication
CREATE TABLE IF NOT EXISTS api_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_users_username ON api_users(username);
CREATE INDEX IF NOT EXISTS idx_api_users_api_key_id ON api_users(api_key_id);

-- 5. Ensure only one user per API key
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_user_per_api_key ON api_users(api_key_id);

-- 6. Create table for API access logs (optional but useful)
CREATE TABLE IF NOT EXISTS api_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    api_user_id UUID REFERENCES api_users(id) ON DELETE CASCADE,
    endpoint VARCHAR(500),
    method VARCHAR(10),
    status_code INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_body TEXT,
    response_body TEXT,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_api_key ON api_access_logs(api_key_id);

-- Done! Run this entire script in PGAdmin

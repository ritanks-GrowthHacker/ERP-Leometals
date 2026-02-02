-- ==========================================
-- Add erp_organization_id to api_keys table
-- This allows API users to be associated with an organization
-- Run this in PGAdmin on erp_sales database
-- ==========================================

-- Add erp_organization_id column to api_keys table if it doesn't exist
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS erp_organization_id UUID REFERENCES erp_organizations(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_erp_org ON api_keys(erp_organization_id);

-- Note: You'll need to update existing API keys with an erp_organization_id
-- Example:
-- UPDATE api_keys SET erp_organization_id = 'your-erp-org-id' WHERE id = 'api-key-id';

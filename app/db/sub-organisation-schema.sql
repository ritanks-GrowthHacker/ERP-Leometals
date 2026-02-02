-- Sub Organizations Table for External Platform Integrations
-- Run this in erp_sales database ONLY

-- Create sub_organisation table for external platforms
CREATE TABLE IF NOT EXISTS sub_organisation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  website VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  subscription_tier VARCHAR(50) DEFAULT 'free', -- 'free', 'basic', 'premium', 'enterprise'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT unique_sub_org_name UNIQUE(name)
);

-- Create index for faster lookups
CREATE INDEX idx_sub_organisation_active ON sub_organisation(is_active);
CREATE INDEX idx_sub_organisation_name ON sub_organisation(name);

-- Create users table for sub-organisations (if not exists)
CREATE TABLE IF NOT EXISTS sub_organisation_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_organisation_id UUID NOT NULL REFERENCES sub_organisation(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_sub_org_user_email UNIQUE(sub_organisation_id, email)
);

CREATE INDEX idx_sub_org_users_email ON sub_organisation_users(email);
CREATE INDEX idx_sub_org_users_sub_org ON sub_organisation_users(sub_organisation_id);

-- Insert a default sub-organisation for testing
INSERT INTO sub_organisation (name, description, contact_email, subscription_tier)
VALUES ('Default Organization', 'Default organization for API testing', 'admin@example.com', 'enterprise')
ON CONFLICT (name) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE sub_organisation IS 'Organizations for external platform integrations';
COMMENT ON TABLE sub_organisation_users IS 'Users belonging to sub-organisations for API access';

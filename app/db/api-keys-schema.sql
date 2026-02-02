-- API Keys Table for External Platform Integration
-- Run this in erp_sales database ONLY

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) NOT NULL UNIQUE,
  api_secret VARCHAR(255) NOT NULL,
  sub_organisation_id UUID NOT NULL REFERENCES sub_organisation(id) ON DELETE CASCADE,
  user_id UUID REFERENCES sub_organisation_users(id) ON DELETE SET NULL,
  
  -- Permissions and scopes
  scopes TEXT[] DEFAULT ARRAY['read']::TEXT[],
  -- Available scopes: 'read', 'write', 'delete', 'admin'
  
  -- Rate limiting
  rate_limit_per_hour INTEGER DEFAULT 1000,
  requests_made_current_hour INTEGER DEFAULT 0,
  last_request_at TIMESTAMP WITH TIME ZONE,
  rate_limit_reset_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- IP restrictions (optional)
  allowed_ips TEXT[],
  
  -- Webhook configuration (optional)
  webhook_url TEXT,
  webhook_secret TEXT,
  webhook_events TEXT[],
  
  -- Metadata
  description TEXT,
  environment VARCHAR(50) DEFAULT 'production', -- 'production' or 'sandbox'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT valid_environment CHECK (environment IN ('production', 'sandbox'))
);

-- Indexes
CREATE INDEX idx_api_keys_api_key ON api_keys(api_key) WHERE is_active = true;
CREATE INDEX idx_api_keys_sub_organisation ON api_keys(sub_organisation_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- API Request Logs Table
CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  
  -- Request details
  method VARCHAR(10) NOT NULL,
  endpoint TEXT NOT NULL,
  query_params JSONB,
  request_body JSONB,
  
  -- Response details
  status_code INTEGER,
  response_body JSONB,
  response_time_ms INTEGER,
  
  -- Client details
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Error tracking
  error_message TEXT,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for logs
CREATE INDEX idx_api_logs_api_key ON api_request_logs(api_key_id);
CREATE INDEX idx_api_logs_created_at ON api_request_logs(created_at);
CREATE INDEX idx_api_logs_status ON api_request_logs(status_code);

-- Function to clean up old logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM api_request_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- API Key Usage Statistics View
CREATE OR REPLACE VIEW api_key_statistics AS
SELECT 
  ak.id,
  ak.name,
  ak.sub_organisation_id,
  ak.is_active,
  ak.rate_limit_per_hour,
  COUNT(arl.id) as total_requests,
  COUNT(CASE WHEN arl.status_code >= 200 AND arl.status_code < 300 THEN 1 END) as successful_requests,
  COUNT(CASE WHEN arl.status_code >= 400 THEN 1 END) as failed_requests,
  AVG(arl.response_time_ms) as avg_response_time_ms,
  MAX(arl.created_at) as last_request_at
FROM api_keys ak
LEFT JOIN api_request_logs arl ON ak.id = arl.api_key_id
WHERE ak.is_active = true
GROUP BY ak.id, ak.name, ak.sub_organisation_id, ak.is_active, ak.rate_limit_per_hour;

-- Function to reset rate limits hourly
CREATE OR REPLACE FUNCTION reset_rate_limits()
RETURNS void AS $$
BEGIN
  UPDATE api_keys
  SET 
    requests_made_current_hour = 0,
    rate_limit_reset_at = NOW() + INTERVAL '1 hour'
  WHERE rate_limit_reset_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE api_keys IS 'Stores API keys for external platform integration';
COMMENT ON TABLE api_request_logs IS 'Logs all API requests for monitoring and debugging';
COMMENT ON VIEW api_key_statistics IS 'Provides usage statistics for each API key';

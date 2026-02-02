-- Fix existing api_keys to have sub_organisation_id
-- Replace 'YOUR_ORG_ID_HERE' with your actual erp_organization_id

-- First, find your organization ID:
SELECT id FROM erp_organizations;

-- Then update all api_keys that don't have sub_organisation_id:
UPDATE api_keys 
SET sub_organisation_id = 'YOUR_ORG_ID_HERE'
WHERE sub_organisation_id IS NULL;

-- Verify the update:
SELECT id, name, sub_organisation_id FROM api_keys;

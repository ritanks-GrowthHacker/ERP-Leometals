-- ==========================================
-- FIX API USER ORGANIZATION MISMATCH
-- Run these queries in PGAdmin on erp_sales database
-- ==========================================

-- 1. Check which organization YOUR newly created category belongs to
SELECT erp_organization_id, name, created_at
FROM product_categories
WHERE name = 'Electronics';
-- This will show you the CORRECT organization ID where your data is being created

-- 2. Check which organization the old "Nut bolts" category belongs to  
SELECT erp_organization_id, name, created_at
FROM product_categories
WHERE name = 'Nut bolts';

-- 3. Check your current API key configuration
SELECT 
    au.username,
    ak.erp_organization_id as current_org_in_api_key,
    ak.company_name
FROM api_users au
JOIN api_keys ak ON ak.id = au.api_key_id
WHERE au.username = 'ritank102';

-- 4. UPDATE: Set your API key to use the CORRECT organization 
-- (use the erp_organization_id from step 1 where Electronics was created)
UPDATE api_keys 
SET erp_organization_id = (
    SELECT erp_organization_id 
    FROM product_categories 
    WHERE name = 'Electronics' 
    LIMIT 1
)
WHERE id = (
    SELECT api_key_id 
    FROM api_users 
    WHERE username = 'ritank102'
);

-- 5. VERIFY the update worked
SELECT 
    au.username,
    ak.erp_organization_id,
    ak.company_name,
    (SELECT COUNT(*) FROM product_categories WHERE erp_organization_id = ak.erp_organization_id) as category_count
FROM api_users au
JOIN api_keys ak ON ak.id = au.api_key_id
WHERE au.username = 'ritank102';

-- 6. After running this, you MUST get a NEW JWT token by calling:
-- POST /api/v1/auth/token with your username and password
-- The new token will have the correct erpOrganizationId

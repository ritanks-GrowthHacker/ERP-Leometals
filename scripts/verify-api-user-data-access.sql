-- ==========================================
-- API User Data Visibility Verification
-- Use these queries to troubleshoot data access issues
-- ==========================================

-- 1. Check API user's organization mapping
SELECT 
    au.id as api_user_id,
    au.username,
    au.full_name,
    au.is_active,
    ak.id as api_key_id,
    ak.erp_organization_id,
    ak.company_name,
    eo.id as erp_org_id,
    (SELECT main_org_id FROM erp_organizations WHERE id = ak.erp_organization_id) as main_org_id
FROM api_users au
JOIN api_keys ak ON ak.id = au.api_key_id
LEFT JOIN erp_organizations eo ON eo.id = ak.erp_organization_id
WHERE au.username = 'YOUR_API_USERNAME';
-- Expected: erp_organization_id should NOT be NULL

-- 2. If erp_organization_id is NULL, find correct organization
SELECT id, main_org_id FROM erp_organizations;
-- Choose the correct ERP organization ID and update:

-- 3. Update API key with correct organization (if needed)
UPDATE api_keys 
SET erp_organization_id = 'CORRECT_ERP_ORG_UUID_HERE'
WHERE id = (
    SELECT api_key_id 
    FROM api_users 
    WHERE username = 'YOUR_API_USERNAME'
);

-- 4. Verify data exists for this organization
SELECT 
    'Products' as type, 
    COUNT(*) as count 
FROM products 
WHERE erp_organization_id = 'YOUR_ERP_ORG_UUID'
UNION ALL
SELECT 
    'Warehouses' as type, 
    COUNT(*) as count 
FROM warehouses 
WHERE erp_organization_id = 'YOUR_ERP_ORG_UUID'
UNION ALL
SELECT 
    'Purchase Orders' as type, 
    COUNT(*) as count 
FROM purchase_orders 
WHERE erp_organization_id = 'YOUR_ERP_ORG_UUID'
UNION ALL
SELECT 
    'Sales Orders' as type, 
    COUNT(*) as count 
FROM sales_orders 
WHERE erp_organization_id = 'YOUR_ERP_ORG_UUID'
UNION ALL
SELECT 
    'Suppliers' as type, 
    COUNT(*) as count 
FROM suppliers 
WHERE erp_organization_id = 'YOUR_ERP_ORG_UUID'
UNION ALL
SELECT 
    'Customers' as type, 
    COUNT(*) as count 
FROM customers 
WHERE erp_organization_id = 'YOUR_ERP_ORG_UUID';

-- 5. Check stock levels (if products exist but show 0 quantity)
SELECT 
    p.name as product_name,
    p.sku,
    w.name as warehouse_name,
    sl.quantity_on_hand,
    sl.quantity_reserved,
    sl.quantity_available
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
JOIN warehouses w ON w.id = sl.warehouse_id
WHERE p.erp_organization_id = 'YOUR_ERP_ORG_UUID'
ORDER BY p.name;

-- 6. Verify API user is active
SELECT 
    username,
    is_active,
    last_login_at,
    created_at
FROM api_users
WHERE username = 'YOUR_API_USERNAME';

-- 7. Check if multiple organizations exist (might be using wrong one)
SELECT 
    eo.id,
    eo.main_org_id,
    o.name as organization_name,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(DISTINCT po.id) as purchase_order_count,
    COUNT(DISTINCT so.id) as sales_order_count
FROM erp_organizations eo
LEFT JOIN organizations o ON o.id = eo.main_org_id
LEFT JOIN products p ON p.erp_organization_id = eo.id
LEFT JOIN purchase_orders po ON po.erp_organization_id = eo.id
LEFT JOIN sales_orders so ON so.erp_organization_id = eo.id
GROUP BY eo.id, eo.main_org_id, o.name;

-- 8. Full diagnostic for API user
SELECT 
    'API User' as category,
    au.username as detail,
    au.is_active::text as status
FROM api_users au
WHERE au.username = 'YOUR_API_USERNAME'
UNION ALL
SELECT 
    'API Key Organization' as category,
    ak.company_name as detail,
    ak.erp_organization_id::text as status
FROM api_users au
JOIN api_keys ak ON ak.id = au.api_key_id
WHERE au.username = 'YOUR_API_USERNAME'
UNION ALL
SELECT 
    'Products Count' as category,
    COUNT(*)::text as detail,
    'records' as status
FROM products p
JOIN api_keys ak ON ak.erp_organization_id = p.erp_organization_id
JOIN api_users au ON au.api_key_id = ak.id
WHERE au.username = 'YOUR_API_USERNAME'
UNION ALL
SELECT 
    'Purchase Orders Count' as category,
    COUNT(*)::text as detail,
    'records' as status
FROM purchase_orders po
JOIN api_keys ak ON ak.erp_organization_id = po.erp_organization_id
JOIN api_users au ON au.api_key_id = ak.id
WHERE au.username = 'YOUR_API_USERNAME';

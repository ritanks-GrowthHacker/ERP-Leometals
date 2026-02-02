-- Check products without suppliers
SELECT 
  p.id,
  p.name,
  p.sku,
  COUNT(ps.id) as supplier_count,
  STRING_AGG(s.name, ', ') as suppliers
FROM products p
LEFT JOIN product_suppliers ps ON ps.product_id = p.id AND ps.is_active = true
LEFT JOIN suppliers s ON s.id = ps.supplier_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.sku
HAVING COUNT(ps.id) = 0;

-- Check PO suggestions without suppliers
SELECT 
  pos.id,
  p.name as product_name,
  pos.suggested_quantity,
  pos.priority,
  pos.status,
  COUNT(ps.id) as supplier_count
FROM purchase_order_suggestions pos
JOIN products p ON p.id = pos.product_id
LEFT JOIN product_suppliers ps ON ps.product_id = pos.product_id AND ps.is_active = true
WHERE pos.status = 'pending'
GROUP BY pos.id, p.name, pos.suggested_quantity, pos.priority, pos.status
HAVING COUNT(ps.id) = 0;

-- Example: Add a default supplier to products without one
-- First, get or create a default supplier
/*
INSERT INTO suppliers (
  erp_organization_id,
  name,
  code,
  email,
  phone,
  is_active
) VALUES (
  'YOUR_ORG_ID',
  'Default Supplier',
  'SUP001',
  'supplier@example.com',
  '+91 9876543210',
  true
)
ON CONFLICT DO NOTHING
RETURNING id;

-- Then assign this supplier to products
INSERT INTO product_suppliers (
  product_id,
  supplier_id,
  unit_price,
  is_primary,
  is_active
)
SELECT 
  p.id,
  'SUPPLIER_ID_FROM_ABOVE',
  p.cost_price,
  true,
  true
FROM products p
LEFT JOIN product_suppliers ps ON ps.product_id = p.id
WHERE ps.id IS NULL
AND p.is_active = true;
*/

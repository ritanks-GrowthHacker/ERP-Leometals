-- TEST DATA FOR PROCUREMENT FEATURES
-- Run this after comprehensive-inventory-enhancements.sql

-- ============================================
-- ⚠️ IMPORTANT: Run this query FIRST, then copy the IDs
-- ============================================

-- 1. Get your ERP organization ID (copy the 'id' value):
SELECT id as org_id, main_org_id FROM erp_organizations LIMIT 1;

-- 2. Get product IDs (copy the 'id' values you want to use):
SELECT id as product_id, name, sku FROM products LIMIT 10;

-- 3. Get warehouse ID (copy the 'id' value):
SELECT id as warehouse_id, name FROM warehouses LIMIT 1;

-- ============================================
-- ⚠️ AFTER getting IDs above, scroll down and:
-- 1. Find all 'YOUR_ORG_ID' and replace with your org_id
-- 2. Find all 'PRODUCT_ID_1', 'PRODUCT_ID_2', 'PRODUCT_ID_3' and replace with product_id values
-- 3. Find all 'WAREHOUSE_ID_1' and replace with your warehouse_id
-- ============================================

-- ============================================
-- STEP 2: Create Reorder Rules
-- ============================================

-- Example 1: Create reorder rule for Product 1
INSERT INTO reorder_rules (
  erp_organization_id,
  product_id,
  warehouse_id,
  reorder_point,
  reorder_quantity,
  max_quantity,
  lead_time_days,
  priority,
  is_active
) VALUES (
  'YOUR_ORG_ID',        -- Replace with your org ID
  'PRODUCT_ID_1',       -- Replace with actual product ID
  'WAREHOUSE_ID_1',     -- Replace with actual warehouse ID
  10.00,                -- Reorder when stock falls below 10
  50.00,                -- Order 50 units
  100.00,               -- Maximum stock is 100
  7,                    -- 7 days lead time
  'high',               -- Priority: low, normal, high, critical
  true
);

-- Example 2: Create reorder rule for Product 2
INSERT INTO reorder_rules (
  erp_organization_id,
  product_id,
  warehouse_id,
  reorder_point,
  reorder_quantity,
  max_quantity,
  lead_time_days,
  priority,
  is_active
) VALUES (
  'YOUR_ORG_ID',
  'PRODUCT_ID_2',
  'WAREHOUSE_ID_1',
  5.00,
  30.00,
  60.00,
  5,
  'normal',
  true
);

-- Example 3: Reorder rule for ALL warehouses (warehouse_id = NULL)
INSERT INTO reorder_rules (
  erp_organization_id,
  product_id,
  warehouse_id,
  reorder_point,
  reorder_quantity,
  lead_time_days,
  priority,
  is_active
) VALUES (
  'YOUR_ORG_ID',
  'PRODUCT_ID_3',
  NULL,                 -- Applies to all warehouses
  15.00,
  100.00,
  10,
  'critical',
  true
);

-- ============================================
-- STEP 3: Add some sales history (for forecasting)
-- ============================================

-- This helps with demand forecasting and consumption calculation
INSERT INTO sales_history (
  erp_organization_id,
  product_id,
  warehouse_id,
  period_start,
  period_end,
  period_type,
  quantity_sold,
  total_revenue
) VALUES 
  ('YOUR_ORG_ID', 'PRODUCT_ID_1', 'WAREHOUSE_ID_1', '2024-11-01', '2024-11-30', 'monthly', 120.00, 1200.00),
  ('YOUR_ORG_ID', 'PRODUCT_ID_1', 'WAREHOUSE_ID_1', '2024-12-01', '2024-12-31', 'monthly', 150.00, 1500.00),
  ('YOUR_ORG_ID', 'PRODUCT_ID_2', 'WAREHOUSE_ID_1', '2024-11-01', '2024-11-30', 'monthly', 80.00, 800.00),
  ('YOUR_ORG_ID', 'PRODUCT_ID_2', 'WAREHOUSE_ID_1', '2024-12-01', '2024-12-31', 'monthly', 90.00, 900.00);

-- ============================================
-- STEP 4: Generate Purchase Order Suggestions
-- ============================================

-- Run the automated function to generate suggestions based on your reorder rules:
SELECT generate_purchase_order_suggestions();

-- Check if suggestions were created:
SELECT 
  pos.id,
  p.name as product_name,
  pos.current_stock,
  pos.suggested_quantity,
  pos.days_of_stock_remaining,
  pos.priority,
  pos.status
FROM purchase_order_suggestions pos
JOIN products p ON p.id = pos.product_id
ORDER BY 
  CASE pos.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END;

-- ============================================
-- STEP 5: Create a demand forecast (optional)
-- ============================================

INSERT INTO demand_forecasts (
  erp_organization_id,
  product_id,
  warehouse_id,
  forecast_date,
  forecast_period,
  forecasted_quantity,
  forecast_method,
  confidence_level
) VALUES (
  'YOUR_ORG_ID',
  'PRODUCT_ID_1',
  'WAREHOUSE_ID_1',
  '2025-01-31',
  'monthly',
  160.00,
  'moving_average',
  85
);

-- ============================================
-- HELPFUL QUERIES FOR TESTING
-- ============================================

-- View all reorder rules with current stock:
SELECT 
  rr.id,
  p.name as product_name,
  p.sku,
  w.name as warehouse_name,
  rr.reorder_point,
  rr.reorder_quantity,
  COALESCE(SUM(sl.quantity_on_hand - sl.quantity_reserved), 0) as current_stock,
  rr.priority,
  rr.is_active
FROM reorder_rules rr
JOIN products p ON p.id = rr.product_id
LEFT JOIN warehouses w ON w.id = rr.warehouse_id
LEFT JOIN stock_levels sl ON sl.product_id = rr.product_id 
  AND (rr.warehouse_id IS NULL OR sl.warehouse_id = rr.warehouse_id)
GROUP BY rr.id, p.name, p.sku, w.name, rr.reorder_point, rr.reorder_quantity, rr.priority, rr.is_active
ORDER BY rr.created_at DESC;

-- View PO suggestions:
SELECT * FROM purchase_order_suggestions ORDER BY created_at DESC;

-- View demand forecasts:
SELECT 
  df.id,
  p.name as product_name,
  df.forecast_date,
  df.forecasted_quantity,
  df.actual_quantity,
  df.forecast_method,
  df.confidence_level
FROM demand_forecasts df
JOIN products p ON p.id = df.product_id
ORDER BY df.forecast_date;

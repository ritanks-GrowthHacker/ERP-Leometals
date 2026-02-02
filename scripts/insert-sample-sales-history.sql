-- ============================================
-- INSERT SAMPLE SALES HISTORY
-- ============================================
-- This script populates sales_history table with sample data
-- so that PO suggestions can calculate consumption patterns

-- VERIFIED AGAINST ACTUAL DB SCHEMA
-- This script will work with the actual erpDb schema

DO $$
DECLARE
    v_product RECORD;
    v_warehouse RECORD;
    v_date DATE;
    v_days_back INTEGER;
    v_count INTEGER := 0;
BEGIN
    -- Get first warehouse for each org
    FOR v_warehouse IN 
        SELECT DISTINCT w.id as warehouse_id, w.erp_organization_id
        FROM warehouses w
        WHERE w.is_active = true
        LIMIT 1
    LOOP
        -- Loop through active products
        FOR v_product IN 
            SELECT p.id, p.name, p.erp_organization_id 
            FROM products p
            WHERE p.is_active = true
              AND p.product_type = 'storable'
              AND p.erp_organization_id = v_warehouse.erp_organization_id
            LIMIT 20
        LOOP
            -- Insert sales history for last 30 days
            FOR v_days_back IN 1..30 LOOP
                v_date := CURRENT_DATE - v_days_back;
                
                BEGIN
                    INSERT INTO sales_history (
                        erp_organization_id,
                        product_id,
                        warehouse_id,
                        period_start,
                        period_end,
                        quantity_sold,
                        revenue,
                        cost_of_goods_sold,
                        number_of_orders,
                        average_order_quantity
                    ) VALUES (
                        v_product.erp_organization_id,
                        v_product.id,
                        v_warehouse.warehouse_id,
                        v_date,
                        v_date,
                        CASE 
                            WHEN random() < 0.7 THEN floor(random() * 5 + 2)::DECIMAL
                            ELSE 0
                        END,
                        floor(random() * 5000 + 1000)::DECIMAL,
                        floor(random() * 3000 + 500)::DECIMAL,
                        floor(random() * 3 + 1)::INTEGER,
                        floor(random() * 3 + 1)::DECIMAL
                    );
                    v_count := v_count + 1;
                EXCEPTION
                    WHEN OTHERS THEN
                        -- Skip duplicates or errors
                        NULL;
                END;
            END LOOP;
            
            RAISE NOTICE 'Added sales history for product: % (% records)', v_product.name, v_count;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Sales history insertion complete! Total records: %', v_count;
END $$;

-- ============================================
-- VERIFY DATA
-- ============================================

-- Check what was inserted
SELECT 
    p.name,
    p.sku,
    COUNT(*) as days_of_history,
    SUM(sh.quantity_sold) as total_sold,
    ROUND(AVG(sh.quantity_sold), 2) as avg_daily_sold
FROM sales_history sh
JOIN products p ON p.id = sh.product_id
WHERE sh.period_start >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.name, p.sku
ORDER BY p.name;

-- ============================================
-- NOW RUN THE PO GENERATION
-- ============================================

-- After sales history is populated, run this:
-- SELECT generate_purchase_order_suggestions();

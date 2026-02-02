-- Add po_number column to track which PO was created from suggestion
ALTER TABLE purchase_order_suggestions 
ADD COLUMN IF NOT EXISTS po_number VARCHAR(50);

-- Update the function to avoid creating duplicate suggestions for products with pending/ordered suggestions
CREATE OR REPLACE FUNCTION generate_purchase_order_suggestions()
RETURNS void AS $$
DECLARE
    rule_record RECORD;
    current_stock DECIMAL(15,2);
    avg_consumption DECIMAL(15,2);
    days_remaining INTEGER;
    existing_suggestion_count INTEGER;
BEGIN
    FOR rule_record IN 
        SELECT rr.*, p.name as product_name
        FROM reorder_rules rr
        JOIN products p ON p.id = rr.product_id
        WHERE rr.is_active = true
    LOOP
        -- Check if there's already a pending or ordered suggestion for this product
        SELECT COUNT(*)
        INTO existing_suggestion_count
        FROM purchase_order_suggestions
        WHERE product_id = rule_record.product_id
        AND (warehouse_id = rule_record.warehouse_id OR (warehouse_id IS NULL AND rule_record.warehouse_id IS NULL))
        AND status IN ('pending', 'approved', 'ordered')
        AND created_at > CURRENT_DATE - INTERVAL '30 days';
        
        -- Skip if there's already an active suggestion
        IF existing_suggestion_count > 0 THEN
            CONTINUE;
        END IF;
        
        -- Get current stock level
        SELECT COALESCE(SUM(quantity_on_hand - quantity_reserved), 0)
        INTO current_stock
        FROM stock_levels
        WHERE product_id = rule_record.product_id
        AND (rule_record.warehouse_id IS NULL OR warehouse_id = rule_record.warehouse_id);
        
        -- Check if below reorder point
        IF current_stock <= rule_record.reorder_point THEN
            -- Calculate average daily consumption (last 30 days)
            SELECT COALESCE(SUM(quantity_sold) / 30.0, 0)
            INTO avg_consumption
            FROM sales_history
            WHERE product_id = rule_record.product_id
            AND period_start >= CURRENT_DATE - INTERVAL '30 days';
            
            -- Calculate days of stock remaining
            IF avg_consumption > 0 THEN
                days_remaining := FLOOR(current_stock / avg_consumption);
            ELSE
                days_remaining := 9999; -- Very large number if no consumption
            END IF;
            
            -- Insert suggestion
            INSERT INTO purchase_order_suggestions (
                erp_organization_id,
                product_id,
                warehouse_id,
                suggested_quantity,
                current_stock,
                reorder_point,
                average_daily_consumption,
                days_of_stock_remaining,
                estimated_stockout_date,
                priority,
                status
            ) VALUES (
                rule_record.erp_organization_id,
                rule_record.product_id,
                rule_record.warehouse_id,
                rule_record.reorder_quantity,
                current_stock,
                rule_record.reorder_point,
                avg_consumption,
                days_remaining,
                CURRENT_DATE + (days_remaining || ' days')::INTERVAL,
                CASE 
                    WHEN days_remaining <= 3 THEN 'critical'
                    WHEN days_remaining <= 7 THEN 'high'
                    WHEN days_remaining <= 14 THEN 'normal'
                    ELSE 'low'
                END,
                'pending'
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_po_suggestions_status_product 
ON purchase_order_suggestions(product_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_po_suggestions_po_number 
ON purchase_order_suggestions(po_number) 
WHERE po_number IS NOT NULL;

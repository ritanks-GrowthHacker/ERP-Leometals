-- Add columns for location-based tracking and accepted_at timestamp
ALTER TABLE purchase_order_suggestions 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES warehouse_locations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS po_number VARCHAR(50);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_po_suggestions_location ON purchase_order_suggestions(location_id);
CREATE INDEX IF NOT EXISTS idx_po_suggestions_po_number ON purchase_order_suggestions(po_number) WHERE po_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_po_suggestions_accepted_at ON purchase_order_suggestions(accepted_at) WHERE accepted_at IS NOT NULL;

-- Update the function to generate location-based suggestions
CREATE OR REPLACE FUNCTION generate_purchase_order_suggestions()
RETURNS void AS $$
DECLARE
    location_record RECORD;
    current_stock DECIMAL(15,2);
    avg_consumption DECIMAL(15,2);
    days_remaining INTEGER;
    existing_suggestion_count INTEGER;
BEGIN
    -- Loop through each product-warehouse-location combination
    FOR location_record IN 
        SELECT DISTINCT
            sl.product_id,
            sl.warehouse_id,
            sl.location_id,
            p.name as product_name,
            COALESCE(p.reorder_point, 0) as reorder_point,
            COALESCE(p.reorder_quantity, 50) as reorder_quantity,
            p.erp_organization_id,
            wl.name as location_name,
            w.name as warehouse_name,
            sl.quantity_on_hand,
            sl.quantity_reserved
        FROM stock_levels sl
        JOIN products p ON p.id = sl.product_id
        JOIN warehouses w ON w.id = sl.warehouse_id
        LEFT JOIN warehouse_locations wl ON wl.id = sl.location_id
        WHERE p.is_active = true
        AND (sl.quantity_on_hand - sl.quantity_reserved) <= COALESCE(p.reorder_point, 0)
    LOOP
        -- Check if there's already a pending, approved, or ordered suggestion for this location
        SELECT COUNT(*)
        INTO existing_suggestion_count
        FROM purchase_order_suggestions
        WHERE product_id = location_record.product_id
        AND warehouse_id = location_record.warehouse_id
        AND location_id = location_record.location_id
        AND status IN ('pending', 'approved', 'ordered')
        AND created_at > CURRENT_DATE - INTERVAL '30 days';
        
        -- Skip if there's already an active suggestion
        IF existing_suggestion_count > 0 THEN
            CONTINUE;
        END IF;
        
        -- Calculate current available stock at this location (never negative)
        current_stock := GREATEST(location_record.quantity_on_hand - location_record.quantity_reserved, 0);
        
        -- Calculate average daily consumption for this product (last 30 days)
        SELECT COALESCE(SUM(quantity_sold) / 30.0, 0)
        INTO avg_consumption
        FROM sales_history
        WHERE product_id = location_record.product_id
        AND period_start >= CURRENT_DATE - INTERVAL '30 days';
        
        -- Calculate days of stock remaining
        IF avg_consumption > 0 THEN
            days_remaining := FLOOR(current_stock / avg_consumption);
        ELSE
            -- If no consumption data, set to 0 for critical items, 30 for others
            days_remaining := CASE WHEN current_stock <= 0 THEN 0 ELSE 30 END;
        END IF;
        
        -- Only create suggestion if stock is low or out
        IF current_stock <= location_record.reorder_point THEN
            -- Insert suggestion
            INSERT INTO purchase_order_suggestions (
                erp_organization_id,
                product_id,
                warehouse_id,
                location_id,
                suggested_quantity,
                current_stock,
                reorder_point,
                average_daily_consumption,
                days_of_stock_remaining,
                estimated_stockout_date,
                priority,
                status
            ) VALUES (
                location_record.erp_organization_id,
                location_record.product_id,
                location_record.warehouse_id,
                location_record.location_id,
                location_record.reorder_quantity,
                current_stock,
                location_record.reorder_point,
                avg_consumption,
                days_remaining,
                CURRENT_DATE + (days_remaining || ' days')::INTERVAL,
                CASE 
                    WHEN current_stock <= 0 THEN 'critical'
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

-- Add comment
COMMENT ON COLUMN purchase_order_suggestions.location_id IS 'Specific warehouse location for the suggestion';
COMMENT ON COLUMN purchase_order_suggestions.accepted_at IS 'Timestamp when the suggestion was accepted';
COMMENT ON COLUMN purchase_order_suggestions.po_number IS 'PO number created from this suggestion';

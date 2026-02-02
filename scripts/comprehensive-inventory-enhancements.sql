-- ============================================
-- COMPREHENSIVE ERP INVENTORY ENHANCEMENTS
-- ============================================
-- This script adds advanced inventory features:
-- 1. Procurement automation & reorder rules
-- 2. Demand forecasting & planning
-- 3. Cost management (FIFO/LIFO/Weighted Average)
-- 4. Quality control & inspection
-- 5. Advanced analytics & reporting

-- ============================================
-- 1. PROCUREMENT AUTOMATION
-- ============================================

-- Reorder Rules - Automates purchase order triggering
CREATE TABLE IF NOT EXISTS reorder_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    reorder_point DECIMAL(15,2) NOT NULL DEFAULT 0, -- Minimum stock level to trigger reorder
    reorder_quantity DECIMAL(15,2) NOT NULL DEFAULT 0, -- Quantity to order
    max_quantity DECIMAL(15,2), -- Maximum stock level
    lead_time_days INTEGER DEFAULT 0, -- Supplier lead time
    is_active BOOLEAN DEFAULT true,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_reorder_rules_product ON reorder_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_reorder_rules_warehouse ON reorder_rules(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_reorder_rules_active ON reorder_rules(is_active);

-- Purchase Order Suggestions - Generated automatically by system
CREATE TABLE IF NOT EXISTS purchase_order_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    supplier_id UUID, -- References suppliers from purchasing module
    suggested_quantity DECIMAL(15,2) NOT NULL,
    current_stock DECIMAL(15,2),
    reorder_point DECIMAL(15,2),
    average_daily_consumption DECIMAL(15,2),
    days_of_stock_remaining INTEGER,
    estimated_stockout_date DATE,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'ordered'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID -- References users
);

CREATE INDEX IF NOT EXISTS idx_po_suggestions_product ON purchase_order_suggestions(product_id);
CREATE INDEX IF NOT EXISTS idx_po_suggestions_status ON purchase_order_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_po_suggestions_priority ON purchase_order_suggestions(priority);

-- ============================================
-- 2. DEMAND FORECASTING & PLANNING
-- ============================================

-- Demand Forecast - Stores predicted demand for products
CREATE TABLE IF NOT EXISTS demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    forecast_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
    forecasted_quantity DECIMAL(15,2) NOT NULL,
    actual_quantity DECIMAL(15,2), -- Filled after period ends
    forecast_method VARCHAR(50), -- 'moving_average', 'exponential_smoothing', 'linear_regression', 'seasonal'
    confidence_level DECIMAL(5,2), -- 0-100%
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demand_forecasts_product ON demand_forecasts(product_id);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_date ON demand_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_period ON demand_forecasts(forecast_period);

-- Sales History for Forecasting - Aggregated sales data
CREATE TABLE IF NOT EXISTS sales_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    quantity_sold DECIMAL(15,2) NOT NULL DEFAULT 0,
    revenue DECIMAL(15,2) DEFAULT 0,
    cost_of_goods_sold DECIMAL(15,2) DEFAULT 0,
    number_of_orders INTEGER DEFAULT 0,
    average_order_quantity DECIMAL(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_history_product ON sales_history(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_period ON sales_history(period_start, period_end);

-- ============================================
-- 3. COST MANAGEMENT & VALUATION
-- ============================================

-- Inventory Valuation - Tracks cost layers for FIFO/LIFO
CREATE TABLE IF NOT EXISTS inventory_valuation_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    receipt_date TIMESTAMPTZ NOT NULL,
    receipt_reference VARCHAR(255), -- PO number, GRN number, etc.
    quantity_received DECIMAL(15,2) NOT NULL,
    quantity_remaining DECIMAL(15,2) NOT NULL,
    unit_cost DECIMAL(15,2) NOT NULL,
    total_cost DECIMAL(15,2) NOT NULL,
    valuation_method VARCHAR(20) DEFAULT 'FIFO', -- 'FIFO', 'LIFO', 'WEIGHTED_AVG'
    is_consumed BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_valuation_layers_product ON inventory_valuation_layers(product_id);
CREATE INDEX IF NOT EXISTS idx_valuation_layers_warehouse ON inventory_valuation_layers(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_valuation_layers_date ON inventory_valuation_layers(receipt_date);
CREATE INDEX IF NOT EXISTS idx_valuation_layers_consumed ON inventory_valuation_layers(is_consumed);

-- Cost of Goods Sold (COGS) Tracking
CREATE TABLE IF NOT EXISTS cogs_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'sale', 'adjustment', 'scrap', 'return'
    transaction_date TIMESTAMPTZ NOT NULL,
    reference_id UUID, -- Links to sale order, adjustment, etc.
    quantity DECIMAL(15,2) NOT NULL,
    unit_cost DECIMAL(15,2) NOT NULL,
    total_cost DECIMAL(15,2) NOT NULL,
    valuation_method VARCHAR(20),
    warehouse_id UUID REFERENCES warehouses(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cogs_product ON cogs_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_cogs_date ON cogs_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cogs_type ON cogs_transactions(transaction_type);

-- ============================================
-- 4. QUALITY CONTROL & INSPECTION
-- ============================================

-- Quality Inspections
CREATE TABLE IF NOT EXISTS quality_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    inspection_type VARCHAR(50) NOT NULL, -- 'incoming', 'in_process', 'outgoing', 'periodic'
    reference_type VARCHAR(50), -- 'purchase_order', 'production_order', 'stock_movement'
    reference_id UUID,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    lot_serial_id UUID REFERENCES serial_lot_numbers(id),
    quantity_inspected DECIMAL(15,2) NOT NULL,
    quantity_accepted DECIMAL(15,2) DEFAULT 0,
    quantity_rejected DECIMAL(15,2) DEFAULT 0,
    inspection_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'passed', 'failed', 'partial'
    inspection_date TIMESTAMPTZ DEFAULT NOW(),
    inspector_id UUID, -- References users
    defect_details TEXT,
    corrective_action TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_product ON quality_inspections(product_id);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_status ON quality_inspections(inspection_status);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_type ON quality_inspections(inspection_type);

-- Quality Control Criteria
CREATE TABLE IF NOT EXISTS quality_control_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_category_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
    criterion_name VARCHAR(255) NOT NULL,
    criterion_type VARCHAR(50) NOT NULL, -- 'measurement', 'visual', 'testing', 'documentation'
    specification TEXT,
    acceptable_range_min DECIMAL(15,2),
    acceptable_range_max DECIMAL(15,2),
    tolerance DECIMAL(15,2),
    unit_of_measure VARCHAR(50),
    is_mandatory BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_criteria_product ON quality_control_criteria(product_id);
CREATE INDEX IF NOT EXISTS idx_qc_criteria_category ON quality_control_criteria(product_category_id);

-- Quality Inspection Results (detailed measurements)
CREATE TABLE IF NOT EXISTS quality_inspection_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES quality_inspections(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES quality_control_criteria(id) ON DELETE CASCADE,
    measured_value DECIMAL(15,2),
    text_value TEXT,
    result_status VARCHAR(20) DEFAULT 'pass', -- 'pass', 'fail', 'acceptable'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_results_inspection ON quality_inspection_results(inspection_id);

-- ============================================
-- 5. ADVANCED ANALYTICS & REPORTING
-- ============================================

-- Inventory Turnover Tracking
CREATE TABLE IF NOT EXISTS inventory_turnover_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    beginning_inventory DECIMAL(15,2),
    ending_inventory DECIMAL(15,2),
    average_inventory DECIMAL(15,2),
    cogs_period DECIMAL(15,2),
    turnover_ratio DECIMAL(10,2),
    days_in_inventory DECIMAL(10,2),
    abc_classification VARCHAR(1), -- 'A', 'B', 'C'
    fsn_classification VARCHAR(1), -- 'F'ast, 'S'low, 'N'on-moving
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnover_metrics_product ON inventory_turnover_metrics(product_id);
CREATE INDEX IF NOT EXISTS idx_turnover_metrics_period ON inventory_turnover_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_turnover_metrics_abc ON inventory_turnover_metrics(abc_classification);

-- Stock Aging Analysis
CREATE TABLE IF NOT EXISTS stock_aging_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    quantity_0_30_days DECIMAL(15,2) DEFAULT 0,
    quantity_31_60_days DECIMAL(15,2) DEFAULT 0,
    quantity_61_90_days DECIMAL(15,2) DEFAULT 0,
    quantity_91_180_days DECIMAL(15,2) DEFAULT 0,
    quantity_over_180_days DECIMAL(15,2) DEFAULT 0,
    value_0_30_days DECIMAL(15,2) DEFAULT 0,
    value_31_60_days DECIMAL(15,2) DEFAULT 0,
    value_61_90_days DECIMAL(15,2) DEFAULT 0,
    value_91_180_days DECIMAL(15,2) DEFAULT 0,
    value_over_180_days DECIMAL(15,2) DEFAULT 0,
    total_quantity DECIMAL(15,2),
    total_value DECIMAL(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_aging_product ON stock_aging_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_aging_date ON stock_aging_snapshots(snapshot_date);

-- ============================================
-- 6. EXPIRY & RECALL MANAGEMENT
-- ============================================

-- Expiry Tracking (enhanced serial_lot_numbers)
CREATE TABLE IF NOT EXISTS expiry_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    serial_lot_id UUID NOT NULL REFERENCES serial_lot_numbers(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    expiry_date DATE NOT NULL,
    quantity DECIMAL(15,2) NOT NULL,
    days_to_expiry INTEGER,
    alert_level VARCHAR(20), -- 'info', 'warning', 'critical'
    is_resolved BOOLEAN DEFAULT false,
    resolution_action VARCHAR(50), -- 'sold', 'disposed', 'returned', 'extended'
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expiry_alerts_product ON expiry_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_expiry_alerts_date ON expiry_alerts(expiry_date);
CREATE INDEX IF NOT EXISTS idx_expiry_alerts_resolved ON expiry_alerts(is_resolved);

-- Product Recalls
CREATE TABLE IF NOT EXISTS product_recalls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    recall_number VARCHAR(100) NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    recall_reason TEXT NOT NULL,
    severity_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    lot_numbers TEXT[], -- Array of affected lot numbers
    serial_numbers TEXT[], -- Array of affected serial numbers
    quantity_affected DECIMAL(15,2),
    recall_initiated_date DATE NOT NULL,
    recall_status VARCHAR(50) DEFAULT 'active', -- 'active', 'in_progress', 'completed', 'cancelled'
    corrective_action TEXT,
    customer_notification_sent BOOLEAN DEFAULT false,
    authority_notification_sent BOOLEAN DEFAULT false,
    created_by UUID NOT NULL,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recalls_product ON product_recalls(product_id);
CREATE INDEX IF NOT EXISTS idx_recalls_status ON product_recalls(recall_status);

-- ============================================
-- 7. AUTOMATED TRIGGERS & FUNCTIONS
-- ============================================

-- Function to auto-generate purchase order suggestions
CREATE OR REPLACE FUNCTION generate_purchase_order_suggestions()
RETURNS void AS $$
DECLARE
    rule_record RECORD;
    current_stock DECIMAL(15,2);
    avg_consumption DECIMAL(15,2);
    days_remaining INTEGER;
BEGIN
    FOR rule_record IN 
        SELECT rr.*, p.name as product_name
        FROM reorder_rules rr
        JOIN products p ON p.id = rr.product_id
        WHERE rr.is_active = true
    LOOP
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
            
            -- Insert suggestion if not already exists
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
            -- Note: Removed ON CONFLICT as there's no unique constraint
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate ABC classification
CREATE OR REPLACE FUNCTION calculate_abc_classification(org_id UUID, analysis_period INTEGER DEFAULT 365)
RETURNS void AS $$
DECLARE
    product_record RECORD;
    total_revenue DECIMAL(15,2);
    cumulative_revenue DECIMAL(15,2) := 0;
    cumulative_percentage DECIMAL(5,2);
    classification CHAR(1);
BEGIN
    -- Get total revenue for the period
    SELECT COALESCE(SUM(revenue), 0) INTO total_revenue
    FROM sales_history
    WHERE erp_organization_id = org_id
    AND period_start >= CURRENT_DATE - (analysis_period || ' days')::INTERVAL;
    
    -- Process each product by revenue (descending)
    FOR product_record IN
        SELECT 
            sh.product_id,
            SUM(sh.revenue) as product_revenue
        FROM sales_history sh
        WHERE sh.erp_organization_id = org_id
        AND sh.period_start >= CURRENT_DATE - (analysis_period || ' days')::INTERVAL
        GROUP BY sh.product_id
        ORDER BY product_revenue DESC
    LOOP
        cumulative_revenue := cumulative_revenue + product_record.product_revenue;
        cumulative_percentage := (cumulative_revenue / total_revenue) * 100;
        
        -- Assign classification
        IF cumulative_percentage <= 80 THEN
            classification := 'A';
        ELSIF cumulative_percentage <= 95 THEN
            classification := 'B';
        ELSE
            classification := 'C';
        END IF;
        
        -- Update or insert turnover metrics
        INSERT INTO inventory_turnover_metrics (
            erp_organization_id,
            product_id,
            period_start,
            period_end,
            abc_classification
        ) VALUES (
            org_id,
            product_record.product_id,
            CURRENT_DATE - (analysis_period || ' days')::INTERVAL,
            CURRENT_DATE,
            classification
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update expiry alerts
CREATE OR REPLACE FUNCTION update_expiry_alerts()
RETURNS void AS $$
BEGIN
    -- Insert new expiry alerts for items expiring soon
    INSERT INTO expiry_alerts (
        erp_organization_id,
        product_id,
        serial_lot_id,
        warehouse_id,
        expiry_date,
        quantity,
        days_to_expiry,
        alert_level
    )
    SELECT 
        p.erp_organization_id,
        sln.product_id,
        sln.id,
        sln.warehouse_id,
        sln.expiry_date,
        sln.quantity,
        EXTRACT(DAY FROM (sln.expiry_date - CURRENT_DATE))::INTEGER,
        CASE 
            WHEN sln.expiry_date <= CURRENT_DATE THEN 'critical'
            WHEN sln.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
            WHEN sln.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'warning'
            ELSE 'info'
        END
    FROM serial_lot_numbers sln
    JOIN products p ON p.id = sln.product_id
    WHERE sln.expiry_date IS NOT NULL
    AND sln.status = 'available'
    AND sln.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
    AND NOT EXISTS (
        SELECT 1 FROM expiry_alerts ea 
        WHERE ea.serial_lot_id = sln.id 
        AND ea.is_resolved = false
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. SCHEDULED JOBS SETUP (Comments for reference)
-- ============================================

-- Run these functions periodically using pg_cron or external scheduler:
-- SELECT generate_purchase_order_suggestions(); -- Run daily
-- SELECT calculate_abc_classification(org_id); -- Run weekly/monthly
-- SELECT update_expiry_alerts(); -- Run daily

-- ============================================
-- 9. GRANTS & PERMISSIONS
-- ============================================

-- Grant necessary permissions to your application user
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================
-- SCRIPT COMPLETE
-- ============================================

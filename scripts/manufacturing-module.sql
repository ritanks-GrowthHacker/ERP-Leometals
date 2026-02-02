-- ============================================
-- MANUFACTURING MODULE TABLES
-- ============================================

-- Bill of Materials (BOM)
CREATE TABLE IF NOT EXISTS boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    bom_number VARCHAR(100) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    version VARCHAR(50) DEFAULT '1.0',
    effective_from DATE NOT NULL,
    effective_to DATE,
    scrap_percentage DECIMAL(5, 2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, bom_number)
);

CREATE INDEX IF NOT EXISTS idx_boms_org ON boms(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_product ON boms(product_id);
CREATE INDEX IF NOT EXISTS idx_boms_status ON boms(status);

-- BOM Components
CREATE TABLE IF NOT EXISTS bom_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15, 4) NOT NULL,
    scrap_percentage DECIMAL(5, 2) DEFAULT 0,
    component_type VARCHAR(50) DEFAULT 'raw_material',
    sequence INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_components_bom ON bom_components(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_components_product ON bom_components(component_product_id);

-- Work Centers
CREATE TABLE IF NOT EXISTS work_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    capacity_per_day DECIMAL(15, 2) NOT NULL,
    capacity_uom VARCHAR(50) NOT NULL,
    cost_per_hour DECIMAL(15, 2) NOT NULL,
    efficiency DECIMAL(5, 2) DEFAULT 100,
    current_utilization DECIMAL(5, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    location VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_work_centers_org ON work_centers(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_work_centers_status ON work_centers(status);

-- Routings
CREATE TABLE IF NOT EXISTS routings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    routing_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, routing_code)
);

CREATE INDEX IF NOT EXISTS idx_routings_org ON routings(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_routings_product ON routings(product_id);

-- Routing Operations
CREATE TABLE IF NOT EXISTS routing_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routing_id UUID NOT NULL REFERENCES routings(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    operation_name VARCHAR(255) NOT NULL,
    work_center_id UUID NOT NULL REFERENCES work_centers(id) ON DELETE CASCADE,
    setup_time DECIMAL(10, 2) DEFAULT 0,
    run_time_per_unit DECIMAL(10, 2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_operations_routing ON routing_operations(routing_id);
CREATE INDEX IF NOT EXISTS idx_routing_operations_wc ON routing_operations(work_center_id);

-- Manufacturing Orders
CREATE TABLE IF NOT EXISTS manufacturing_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    mo_number VARCHAR(100) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    bom_id UUID REFERENCES boms(id) ON DELETE SET NULL,
    routing_id UUID REFERENCES routings(id) ON DELETE SET NULL,
    planned_quantity DECIMAL(15, 2) NOT NULL,
    produced_quantity DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    priority VARCHAR(50) DEFAULT 'medium',
    scheduled_start DATE NOT NULL,
    scheduled_end DATE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    source_warehouse_id UUID REFERENCES warehouses(id),
    destination_warehouse_id UUID REFERENCES warehouses(id),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, mo_number)
);

CREATE INDEX IF NOT EXISTS idx_mo_org ON manufacturing_orders(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_mo_product ON manufacturing_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_mo_status ON manufacturing_orders(status);
CREATE INDEX IF NOT EXISTS idx_mo_dates ON manufacturing_orders(scheduled_start, scheduled_end);

-- MO Operations
CREATE TABLE IF NOT EXISTS mo_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mo_id UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    operation_name VARCHAR(255) NOT NULL,
    work_center_id UUID NOT NULL REFERENCES work_centers(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    setup_time DECIMAL(10, 2) DEFAULT 0,
    run_time DECIMAL(10, 2) DEFAULT 0,
    actual_time DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mo_operations_mo ON mo_operations(mo_id);
CREATE INDEX IF NOT EXISTS idx_mo_operations_wc ON mo_operations(work_center_id);

-- Material Consumption
CREATE TABLE IF NOT EXISTS material_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mo_id UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    required_quantity DECIMAL(15, 4) NOT NULL,
    consumed_quantity DECIMAL(15, 4) DEFAULT 0,
    warehouse_id UUID REFERENCES warehouses(id),
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_consumption_mo ON material_consumption(mo_id);
CREATE INDEX IF NOT EXISTS idx_material_consumption_product ON material_consumption(product_id);

-- Production Output
CREATE TABLE IF NOT EXISTS production_output (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mo_id UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15, 2) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id),
    output_date DATE NOT NULL,
    batch_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_output_mo ON production_output(mo_id);
CREATE INDEX IF NOT EXISTS idx_production_output_date ON production_output(output_date);

-- Quality Checks
CREATE TABLE IF NOT EXISTS quality_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    qc_number VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(100),
    source_reference VARCHAR(100),
    quantity_checked DECIMAL(15, 2) NOT NULL,
    quantity_passed DECIMAL(15, 2) DEFAULT 0,
    quantity_failed DECIMAL(15, 2) DEFAULT 0,
    quantity_rework DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    inspector VARCHAR(255),
    check_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(erp_organization_id, qc_number)
);

CREATE INDEX IF NOT EXISTS idx_qc_org ON quality_checks(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_qc_product ON quality_checks(product_id);
CREATE INDEX IF NOT EXISTS idx_qc_type ON quality_checks(type);
CREATE INDEX IF NOT EXISTS idx_qc_status ON quality_checks(status);

-- QC Checkpoints
CREATE TABLE IF NOT EXISTS qc_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qc_id UUID NOT NULL REFERENCES quality_checks(id) ON DELETE CASCADE,
    parameter VARCHAR(255) NOT NULL,
    specification TEXT,
    actual_value TEXT,
    result VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_checkpoints_qc ON qc_checkpoints(qc_id);

-- QC Defects
CREATE TABLE IF NOT EXISTS qc_defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qc_id UUID NOT NULL REFERENCES quality_checks(id) ON DELETE CASCADE,
    defect_type VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    quantity DECIMAL(15, 2) NOT NULL,
    action VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_defects_qc ON qc_defects(qc_id);

-- Downtime Log
CREATE TABLE IF NOT EXISTS downtime_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_center_id UUID NOT NULL REFERENCES work_centers(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    reason TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_downtime_log_wc ON downtime_log(work_center_id);
CREATE INDEX IF NOT EXISTS idx_downtime_log_dates ON downtime_log(start_date, end_date);

-- ============================================
-- INSERT SAMPLE MANUFACTURING DATA
-- ============================================

DO $$
DECLARE
    org_id UUID;
    product_widget UUID;
    product_steel UUID;
    product_bolt UUID;
    product_circuit UUID;
    wc_cnc01 UUID;
    wc_assy01 UUID;
    wc_qc01 UUID;
    wc_pkg01 UUID;
    bom_widget UUID;
    routing_widget UUID;
    mo1 UUID;
BEGIN
    -- Get first organization
    SELECT id INTO org_id FROM erp_organizations LIMIT 1;
    
    IF org_id IS NULL THEN
        RAISE NOTICE 'No organization found. Skipping sample data insertion.';
        RETURN;
    END IF;

    -- Get sample products
    SELECT id INTO product_widget FROM products WHERE sku = 'AWA-001' LIMIT 1;
    SELECT id INTO product_steel FROM products WHERE sku = 'SS-100' LIMIT 1;
    SELECT id INTO product_circuit FROM products WHERE sku = 'PCB-01' LIMIT 1;
    SELECT id INTO product_bolt FROM products WHERE sku = 'BLT-M6' LIMIT 1;

    -- Insert Work Centers (with ON CONFLICT)
    INSERT INTO work_centers (erp_organization_id, code, name, type, capacity_per_day, capacity_uom, cost_per_hour, efficiency, current_utilization, status, location)
    VALUES 
        (org_id, 'CNC-01', 'CNC Machine 1', 'machine', 16, 'hours', 50, 92, 75, 'active', 'Production Floor A'),
        (org_id, 'ASSY-01', 'Assembly Line 1', 'assembly_line', 100, 'units', 80, 88, 60, 'active', 'Production Floor B'),
        (org_id, 'QC-01', 'Quality Control Station', 'testing', 200, 'units', 35, 95, 45, 'active', 'Quality Lab'),
        (org_id, 'PKG-01', 'Packaging Line 1', 'packaging', 500, 'units', 40, 85, 20, 'idle', 'Packaging Area')
    ON CONFLICT (erp_organization_id, code) DO NOTHING;

    -- Get work center IDs
    SELECT id INTO wc_cnc01 FROM work_centers WHERE code = 'CNC-01' AND erp_organization_id = org_id LIMIT 1;
    SELECT id INTO wc_assy01 FROM work_centers WHERE code = 'ASSY-01' AND erp_organization_id = org_id LIMIT 1;
    SELECT id INTO wc_qc01 FROM work_centers WHERE code = 'QC-01' AND erp_organization_id = org_id LIMIT 1;
    SELECT id INTO wc_pkg01 FROM work_centers WHERE code = 'PKG-01' AND erp_organization_id = org_id LIMIT 1;

    -- Insert BOM (if products exist)
    IF product_widget IS NOT NULL THEN
        INSERT INTO boms (erp_organization_id, bom_number, product_id, version, effective_from, scrap_percentage, status)
        VALUES (org_id, 'BOM-001', product_widget, '1.2', CURRENT_DATE, 2.5, 'active')
        ON CONFLICT (erp_organization_id, bom_number) DO NOTHING
        RETURNING id INTO bom_widget;

        IF bom_widget IS NULL THEN
            SELECT id INTO bom_widget FROM boms WHERE bom_number = 'BOM-001' AND erp_organization_id = org_id LIMIT 1;
        END IF;

        -- BOM Components
        IF bom_widget IS NOT NULL THEN
            IF product_steel IS NOT NULL THEN
                INSERT INTO bom_components (bom_id, component_product_id, quantity, component_type, sequence)
                VALUES (bom_widget, product_steel, 0.5, 'raw_material', 1)
                ON CONFLICT DO NOTHING;
            END IF;
            
            IF product_bolt IS NOT NULL THEN
                INSERT INTO bom_components (bom_id, component_product_id, quantity, component_type, sequence)
                VALUES (bom_widget, product_bolt, 4, 'raw_material', 2)
                ON CONFLICT DO NOTHING;
            END IF;
            
            IF product_circuit IS NOT NULL THEN
                INSERT INTO bom_components (bom_id, component_product_id, quantity, component_type, sequence)
                VALUES (bom_widget, product_circuit, 1, 'raw_material', 3)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;

    -- Insert Routing
    IF product_widget IS NOT NULL AND wc_cnc01 IS NOT NULL THEN
        INSERT INTO routings (erp_organization_id, routing_code, name, product_id, status)
        VALUES (org_id, 'RT-001', 'Standard Widget Assembly', product_widget, 'active')
        ON CONFLICT (erp_organization_id, routing_code) DO NOTHING
        RETURNING id INTO routing_widget;

        IF routing_widget IS NULL THEN
            SELECT id INTO routing_widget FROM routings WHERE routing_code = 'RT-001' AND erp_organization_id = org_id LIMIT 1;
        END IF;

        -- Routing Operations
        IF routing_widget IS NOT NULL THEN
            INSERT INTO routing_operations (routing_id, sequence, operation_name, work_center_id, setup_time, run_time_per_unit, description)
            VALUES 
                (routing_widget, 1, 'Material Preparation', wc_cnc01, 30, 15, 'Cut and prepare raw materials'),
                (routing_widget, 2, 'Component Assembly', wc_assy01, 15, 20, 'Assemble components together'),
                (routing_widget, 3, 'Quality Inspection', wc_qc01, 10, 5, 'Inspect assembled product'),
                (routing_widget, 4, 'Packaging', wc_pkg01, 10, 8, 'Package finished product')
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- Insert Manufacturing Order
    IF product_widget IS NOT NULL THEN
        INSERT INTO manufacturing_orders (erp_organization_id, mo_number, product_id, bom_id, routing_id, planned_quantity, produced_quantity, status, priority, scheduled_start, scheduled_end)
        VALUES (org_id, 'MO-2024-001', product_widget, bom_widget, routing_widget, 100, 45, 'in_progress', 'high', CURRENT_DATE, CURRENT_DATE + INTERVAL '5 days')
        ON CONFLICT (erp_organization_id, mo_number) DO NOTHING
        RETURNING id INTO mo1;

        IF mo1 IS NULL THEN
            SELECT id INTO mo1 FROM manufacturing_orders WHERE mo_number = 'MO-2024-001' AND erp_organization_id = org_id LIMIT 1;
        END IF;

        -- MO Operations
        IF mo1 IS NOT NULL AND wc_cnc01 IS NOT NULL THEN
            INSERT INTO mo_operations (mo_id, operation_name, work_center_id, sequence, setup_time, run_time, actual_time, status)
            VALUES 
                (mo1, 'Material Preparation', wc_cnc01, 1, 30, 120, 125, 'done'),
                (mo1, 'Component Assembly', wc_assy01, 2, 15, 180, 90, 'in_progress'),
                (mo1, 'Quality Inspection', wc_qc01, 3, 10, 60, NULL, 'pending'),
                (mo1, 'Packaging', wc_pkg01, 4, 10, 80, NULL, 'pending')
            ON CONFLICT DO NOTHING;
        END IF;

        -- Material Consumption
        IF mo1 IS NOT NULL AND product_steel IS NOT NULL THEN
            INSERT INTO material_consumption (mo_id, product_id, required_quantity, consumed_quantity)
            VALUES 
                (mo1, product_steel, 50, 22.5),
                (mo1, product_bolt, 400, 180)
            ON CONFLICT DO NOTHING;
            
            IF product_circuit IS NOT NULL THEN
                INSERT INTO material_consumption (mo_id, product_id, required_quantity, consumed_quantity)
                VALUES (mo1, product_circuit, 100, 45)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;

    -- Insert Quality Checks
    IF product_steel IS NOT NULL THEN
        INSERT INTO quality_checks (erp_organization_id, qc_number, type, product_id, batch_number, source_reference, quantity_checked, quantity_passed, quantity_failed, status, inspector, check_date)
        VALUES (org_id, 'QC-2024-001', 'incoming', product_steel, 'BATCH-001', 'PO-2024-012', 100, 95, 5, 'passed', 'John Doe', CURRENT_DATE)
        ON CONFLICT (erp_organization_id, qc_number) DO NOTHING;
    END IF;

    IF product_widget IS NOT NULL THEN
        INSERT INTO quality_checks (erp_organization_id, qc_number, type, product_id, batch_number, source_reference, quantity_checked, quantity_passed, quantity_failed, quantity_rework, status, inspector, check_date)
        VALUES (org_id, 'QC-2024-002', 'in_process', product_widget, 'BATCH-002', 'MO-2024-001', 50, 40, 5, 5, 'partial', 'Jane Smith', CURRENT_DATE)
        ON CONFLICT (erp_organization_id, qc_number) DO NOTHING;
    END IF;

    RAISE NOTICE 'Manufacturing sample data processed successfully';
END $$;

-- ============================================
-- DROP ALL MANUFACTURING TABLES
-- ============================================
DROP TABLE IF EXISTS qc_defects CASCADE;
DROP TABLE IF EXISTS qc_checkpoints CASCADE;
DROP TABLE IF EXISTS quality_checks CASCADE;
DROP TABLE IF EXISTS downtime_log CASCADE;
DROP TABLE IF EXISTS production_output CASCADE;
DROP TABLE IF EXISTS material_consumption CASCADE;
DROP TABLE IF EXISTS mo_operations CASCADE;
DROP TABLE IF EXISTS manufacturing_orders CASCADE;
DROP TABLE IF EXISTS routing_operations CASCADE;
DROP TABLE IF EXISTS routings CASCADE;
DROP TABLE IF EXISTS work_centers CASCADE;
DROP TABLE IF EXISTS bom_components CASCADE;
DROP TABLE IF EXISTS boms CASCADE;

-- ============================================
-- CREATE MANUFACTURING TABLES
-- ============================================

-- Bill of Materials
CREATE TABLE boms (
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

CREATE INDEX idx_boms_org ON boms(erp_organization_id);
CREATE INDEX idx_boms_product ON boms(product_id);

-- BOM Components
CREATE TABLE bom_components (
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

CREATE INDEX idx_bom_components_bom ON bom_components(bom_id);
CREATE INDEX idx_bom_components_product ON bom_components(component_product_id);

-- Work Centers
CREATE TABLE work_centers (
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

CREATE INDEX idx_work_centers_org ON work_centers(erp_organization_id);
CREATE INDEX idx_work_centers_status ON work_centers(status);

-- Routings
CREATE TABLE routings (
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

CREATE INDEX idx_routings_org ON routings(erp_organization_id);
CREATE INDEX idx_routings_product ON routings(product_id);

-- Routing Operations
CREATE TABLE routing_operations (
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

CREATE INDEX idx_routing_operations_routing ON routing_operations(routing_id);
CREATE INDEX idx_routing_operations_wc ON routing_operations(work_center_id);

-- Manufacturing Orders
CREATE TABLE manufacturing_orders (
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

CREATE INDEX idx_mo_org ON manufacturing_orders(erp_organization_id);
CREATE INDEX idx_mo_product ON manufacturing_orders(product_id);
CREATE INDEX idx_mo_status ON manufacturing_orders(status);
CREATE INDEX idx_mo_dates ON manufacturing_orders(scheduled_start, scheduled_end);

-- MO Operations
CREATE TABLE mo_operations (
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

CREATE INDEX idx_mo_operations_mo ON mo_operations(mo_id);
CREATE INDEX idx_mo_operations_wc ON mo_operations(work_center_id);

-- Material Consumption
CREATE TABLE material_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mo_id UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    required_quantity DECIMAL(15, 4) NOT NULL,
    consumed_quantity DECIMAL(15, 4) DEFAULT 0,
    warehouse_id UUID REFERENCES warehouses(id),
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_material_consumption_mo ON material_consumption(mo_id);
CREATE INDEX idx_material_consumption_product ON material_consumption(product_id);

-- Production Output
CREATE TABLE production_output (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mo_id UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15, 2) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id),
    output_date DATE NOT NULL,
    batch_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_production_output_mo ON production_output(mo_id);
CREATE INDEX idx_production_output_date ON production_output(output_date);

-- Quality Checks
CREATE TABLE quality_checks (
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

CREATE INDEX idx_qc_org ON quality_checks(erp_organization_id);
CREATE INDEX idx_qc_product ON quality_checks(product_id);
CREATE INDEX idx_qc_type ON quality_checks(type);

-- QC Checkpoints
CREATE TABLE qc_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qc_id UUID NOT NULL REFERENCES quality_checks(id) ON DELETE CASCADE,
    checkpoint_name VARCHAR(255) NOT NULL,
    specification TEXT,
    measured_value TEXT,
    result VARCHAR(50) DEFAULT 'pending',
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_qc_checkpoints_qc ON qc_checkpoints(qc_id);

-- QC Defects
CREATE TABLE qc_defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qc_id UUID NOT NULL REFERENCES quality_checks(id) ON DELETE CASCADE,
    defect_type VARCHAR(100) NOT NULL,
    description TEXT,
    quantity DECIMAL(15, 2) NOT NULL,
    severity VARCHAR(50),
    action VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_qc_defects_qc ON qc_defects(qc_id);

-- Downtime Log
CREATE TABLE downtime_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_center_id UUID NOT NULL REFERENCES work_centers(id) ON DELETE CASCADE,
    reason VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_downtime_log_wc ON downtime_log(work_center_id);
CREATE INDEX idx_downtime_log_dates ON downtime_log(start_date, end_date);

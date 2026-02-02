-- ============================================
-- MANUFACTURING MODULE SCHEMA EXTENSIONS
-- Production-Grade Enhancements
-- ============================================
-- Run these SQL statements manually in pgAdmin
-- DO NOT run migrations - execute directly

-- ============================================
-- A. OPERATION EXECUTION TRACKING
-- ============================================

-- Add operator assignment and detailed time tracking to mo_operations
ALTER TABLE mo_operations 
ADD COLUMN IF NOT EXISTS operator_id UUID,
ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS pause_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pause_duration DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scrap_quantity DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scrap_reason TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Operation execution log for pause/resume tracking
CREATE TABLE IF NOT EXISTS mo_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mo_operation_id UUID NOT NULL REFERENCES mo_operations(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'start', 'pause', 'resume', 'complete', 'cancel'
  performed_by UUID,
  performed_by_name VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mo_operation_logs_mo_operation ON mo_operation_logs(mo_operation_id);
CREATE INDEX IF NOT EXISTS idx_mo_operation_logs_action ON mo_operation_logs(action);

-- ============================================
-- B. REWORK & EXCEPTION HANDLING
-- ============================================

-- Rework orders table
CREATE TABLE IF NOT EXISTS rework_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  rework_number VARCHAR(100) NOT NULL UNIQUE,
  parent_mo_id UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  defect_quantity DECIMAL(15, 2) NOT NULL,
  rework_quantity DECIMAL(15, 2) NOT NULL,
  completed_quantity DECIMAL(15, 2) DEFAULT 0,
  defect_type VARCHAR(100),
  defect_description TEXT,
  root_cause TEXT,
  corrective_action TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  priority VARCHAR(50) DEFAULT 'medium',
  assigned_to UUID,
  scheduled_start DATE,
  scheduled_end DATE,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rework_orders_parent_mo ON rework_orders(parent_mo_id);
CREATE INDEX IF NOT EXISTS idx_rework_orders_status ON rework_orders(status);
CREATE INDEX IF NOT EXISTS idx_rework_orders_org ON rework_orders(erp_organization_id);

-- MO closure exceptions
CREATE TABLE IF NOT EXISTS mo_closure_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mo_id UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
  exception_type VARCHAR(50) NOT NULL, -- 'short_close', 'force_close', 'over_consumption'
  reason TEXT NOT NULL,
  variance_quantity DECIMAL(15, 2),
  variance_percentage DECIMAL(5, 2),
  requested_by UUID,
  requested_by_name VARCHAR(255),
  approved_by UUID,
  approved_by_name VARCHAR(255),
  approval_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approval_notes TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_mo_closure_exceptions_mo ON mo_closure_exceptions(mo_id);
CREATE INDEX IF NOT EXISTS idx_mo_closure_exceptions_status ON mo_closure_exceptions(approval_status);

-- ============================================
-- C. TRACEABILITY & GENEALOGY
-- ============================================

-- Batch/Lot master
CREATE TABLE IF NOT EXISTS production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  batch_number VARCHAR(100) NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  mo_id UUID REFERENCES manufacturing_orders(id) ON DELETE SET NULL,
  quantity DECIMAL(15, 2) NOT NULL,
  production_date DATE NOT NULL,
  expiry_date DATE,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'quarantine', 'recalled', 'expired'
  warehouse_id UUID REFERENCES warehouses(id),
  qc_status VARCHAR(50), -- 'pending', 'passed', 'failed'
  qc_date DATE,
  qc_certificate_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_production_batches_number_product ON production_batches(batch_number, product_id, erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_mo ON production_batches(mo_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_product ON production_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_status ON production_batches(status);

-- Batch genealogy/lineage
CREATE TABLE IF NOT EXISTS batch_genealogy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  parent_batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
  parent_material_id UUID REFERENCES products(id) ON DELETE CASCADE,
  parent_batch_number VARCHAR(100),
  quantity_consumed DECIMAL(15, 4) NOT NULL,
  mo_id UUID REFERENCES manufacturing_orders(id) ON DELETE SET NULL,
  consumed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_genealogy_child ON batch_genealogy(child_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_genealogy_parent ON batch_genealogy(parent_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_genealogy_mo ON batch_genealogy(mo_id);

-- Batch recall tracking
CREATE TABLE IF NOT EXISTS batch_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  recall_number VARCHAR(100) NOT NULL UNIQUE,
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  recall_reason TEXT NOT NULL,
  recall_type VARCHAR(50) NOT NULL, -- 'voluntary', 'regulatory', 'customer_complaint'
  severity VARCHAR(50) NOT NULL, -- 'critical', 'major', 'minor'
  affected_quantity DECIMAL(15, 2),
  recalled_quantity DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'initiated', -- 'initiated', 'in_progress', 'completed', 'closed'
  initiated_by UUID,
  initiated_by_name VARCHAR(255),
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  target_completion_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_recalls_batch ON batch_recalls(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_recalls_status ON batch_recalls(status);
CREATE INDEX IF NOT EXISTS idx_batch_recalls_org ON batch_recalls(erp_organization_id);

-- ============================================
-- D. SUBCONTRACT / JOB WORK
-- ============================================

-- Subcontract manufacturing orders
ALTER TABLE manufacturing_orders 
ADD COLUMN IF NOT EXISTS is_subcontract BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subcontract_vendor_id UUID,
ADD COLUMN IF NOT EXISTS subcontract_po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS material_issue_challan VARCHAR(100),
ADD COLUMN IF NOT EXISTS material_issue_date DATE,
ADD COLUMN IF NOT EXISTS expected_return_date DATE,
ADD COLUMN IF NOT EXISTS actual_return_date DATE;

-- Job work challans
CREATE TABLE IF NOT EXISTS job_work_challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  challan_number VARCHAR(100) NOT NULL UNIQUE,
  mo_id UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL,
  vendor_name VARCHAR(255),
  challan_type VARCHAR(50) NOT NULL, -- 'outward', 'inward'
  challan_date DATE NOT NULL,
  vehicle_number VARCHAR(50),
  transporter_name VARCHAR(255),
  lr_number VARCHAR(100),
  expected_return_date DATE,
  actual_return_date DATE,
  gst_job_work_declaration VARCHAR(255), -- GST compliance reference
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'partial', 'closed', 'cancelled'
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_work_challans_mo ON job_work_challans(mo_id);
CREATE INDEX IF NOT EXISTS idx_job_work_challans_vendor ON job_work_challans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_job_work_challans_org ON job_work_challans(erp_organization_id);

-- Job work challan items
CREATE TABLE IF NOT EXISTS job_work_challan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID NOT NULL REFERENCES job_work_challans(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number VARCHAR(100),
  issued_quantity DECIMAL(15, 4),
  received_quantity DECIMAL(15, 4) DEFAULT 0,
  rejected_quantity DECIMAL(15, 4) DEFAULT 0,
  shortage_quantity DECIMAL(15, 4) DEFAULT 0,
  excess_quantity DECIMAL(15, 4) DEFAULT 0,
  scrap_quantity DECIMAL(15, 4) DEFAULT 0,
  uom VARCHAR(50),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_work_challan_items_challan ON job_work_challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_job_work_challan_items_product ON job_work_challan_items(product_id);

-- ============================================
-- E. ENGINEERING CHANGE CONTROL
-- ============================================

-- Engineering Change Requests
CREATE TABLE IF NOT EXISTS engineering_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  ecr_number VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  change_type VARCHAR(50) NOT NULL, -- 'bom', 'routing', 'product_spec', 'process'
  reason TEXT NOT NULL,
  impact_assessment TEXT,
  affected_products TEXT[], -- Array of product IDs as text
  affected_boms TEXT[], -- Array of BOM IDs as text
  affected_routings TEXT[], -- Array of routing IDs as text
  priority VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'under_review', 'approved', 'rejected', 'implemented'
  requested_by UUID,
  requested_by_name VARCHAR(255),
  reviewed_by UUID,
  reviewed_by_name VARCHAR(255),
  approved_by UUID,
  approved_by_name VARCHAR(255),
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecr_org ON engineering_change_requests(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_ecr_status ON engineering_change_requests(status);

-- Engineering Change Orders
CREATE TABLE IF NOT EXISTS engineering_change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  eco_number VARCHAR(100) NOT NULL UNIQUE,
  ecr_id UUID REFERENCES engineering_change_requests(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  implementation_plan TEXT,
  effective_date DATE NOT NULL,
  completion_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  impact_on_active_mos INTEGER DEFAULT 0,
  impact_on_planned_mos INTEGER DEFAULT 0,
  created_by UUID,
  created_by_name VARCHAR(255),
  implemented_by UUID,
  implemented_by_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eco_org ON engineering_change_orders(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_eco_ecr ON engineering_change_orders(ecr_id);
CREATE INDEX IF NOT EXISTS idx_eco_status ON engineering_change_orders(status);
CREATE INDEX IF NOT EXISTS idx_eco_effective_date ON engineering_change_orders(effective_date);

-- ECO Changes (specific changes made)
CREATE TABLE IF NOT EXISTS eco_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eco_id UUID NOT NULL REFERENCES engineering_change_orders(id) ON DELETE CASCADE,
  change_type VARCHAR(50) NOT NULL, -- 'bom_add', 'bom_remove', 'bom_update', 'routing_add', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'bom', 'bom_component', 'routing', 'routing_operation'
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  change_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eco_changes_eco ON eco_changes(eco_id);

-- ============================================
-- F. AUDIT & COMPLIANCE
-- ============================================

-- Audit trail for manufacturing entities
CREATE TABLE IF NOT EXISTS manufacturing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'bom', 'bom_component', 'routing', 'routing_operation', 'mo', 'work_center'
  entity_id UUID NOT NULL,
  entity_identifier VARCHAR(255), -- Human-readable ID (e.g., BOM number, MO number)
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'status_change'
  field_name VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  user_id UUID,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  ip_address VARCHAR(50),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfg_audit_entity ON manufacturing_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mfg_audit_timestamp ON manufacturing_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mfg_audit_user ON manufacturing_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mfg_audit_org ON manufacturing_audit_log(erp_organization_id);

-- Add versioning to BOMs
ALTER TABLE boms 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES boms(id),
ADD COLUMN IF NOT EXISTS change_notes TEXT;

-- Add versioning to routings
ALTER TABLE routings 
ADD COLUMN IF NOT EXISTS version VARCHAR(50) DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES routings(id),
ADD COLUMN IF NOT EXISTS change_notes TEXT;

-- ============================================
-- ADDITIONAL ENHANCEMENTS
-- ============================================

-- Add scrap tracking to manufacturing orders
ALTER TABLE manufacturing_orders 
ADD COLUMN IF NOT EXISTS scrap_quantity DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scrap_percentage DECIMAL(5, 2) DEFAULT 0;

-- Add batch tracking to production output
ALTER TABLE production_output 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES production_batches(id),
ADD COLUMN IF NOT EXISTS serial_numbers TEXT[];

-- Add batch tracking to material consumption
ALTER TABLE material_consumption 
ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES production_batches(id);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE mo_operation_logs IS 'Tracks detailed execution history of manufacturing operations including start, pause, resume, complete actions';
COMMENT ON TABLE rework_orders IS 'Manages rework orders for defective products from manufacturing orders';
COMMENT ON TABLE mo_closure_exceptions IS 'Tracks exceptional closures like short close, force close, and over-consumption with approval workflow';
COMMENT ON TABLE production_batches IS 'Master table for production batch/lot tracking with full traceability';
COMMENT ON TABLE batch_genealogy IS 'Links child batches to parent material batches for complete forward and backward traceability';
COMMENT ON TABLE batch_recalls IS 'Manages batch recall processes for quality or regulatory issues';
COMMENT ON TABLE job_work_challans IS 'Tracks material challans sent to subcontractors for job work';
COMMENT ON TABLE engineering_change_requests IS 'Engineering change request workflow before formal ECO';
COMMENT ON TABLE engineering_change_orders IS 'Formal engineering changes with effective dates and impact tracking';
COMMENT ON TABLE manufacturing_audit_log IS 'Complete audit trail of all manufacturing data changes for compliance';

-- ============================================
-- END OF SCHEMA EXTENSIONS
-- ============================================

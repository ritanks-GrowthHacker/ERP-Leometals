-- Add metal-specific fields to products table for Leo Metals
-- This migration adds fields specific to metal products

-- Add metal-specific product attributes
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS metal_grade VARCHAR(100), -- e.g., 'A36', '304', '316L', 'MS', 'SS'
  ADD COLUMN IF NOT EXISTS metal_alloy_type VARCHAR(100), -- e.g., 'Steel', 'Aluminum', 'Copper', 'Stainless Steel'
  ADD COLUMN IF NOT EXISTS metal_thickness DECIMAL(15, 4), -- in millimeters
  ADD COLUMN IF NOT EXISTS metal_width DECIMAL(15, 4), -- in millimeters or meters
  ADD COLUMN IF NOT EXISTS metal_length DECIMAL(15, 4), -- in millimeters or meters
  ADD COLUMN IF NOT EXISTS metal_diameter DECIMAL(15, 4), -- in millimeters (for rods, pipes)
  ADD COLUMN IF NOT EXISTS metal_finish VARCHAR(100), -- e.g., 'Polished', 'Matte', 'Galvanized', 'Painted'
  ADD COLUMN IF NOT EXISTS metal_form VARCHAR(100), -- e.g., 'Sheet', 'Plate', 'Rod', 'Tube', 'Pipe', 'Coil', 'Bar'
  ADD COLUMN IF NOT EXISTS weight_per_unit DECIMAL(15, 4), -- weight in kg per unit
  ADD COLUMN IF NOT EXISTS weight_calculation_formula TEXT, -- formula for calculating weight (e.g., for sheets: thickness * width * length * density)
  ADD COLUMN IF NOT EXISTS metal_certification VARCHAR(255), -- e.g., 'ISO 9001', 'CE Mark', 'BIS Certification'
  ADD COLUMN IF NOT EXISTS metal_test_certificate VARCHAR(255), -- mill test certificate number
  ADD COLUMN IF NOT EXISTS metal_heat_treatment VARCHAR(100), -- e.g., 'Annealed', 'Tempered', 'Hardened'
  ADD COLUMN IF NOT EXISTS metal_coating VARCHAR(100), -- e.g., 'Zinc', 'Chrome', 'Nickel'
  ADD COLUMN IF NOT EXISTS carbon_content DECIMAL(5, 3), -- percentage of carbon content
  ADD COLUMN IF NOT EXISTS metal_density DECIMAL(15, 6), -- density in g/cm³ or kg/m³
  ADD COLUMN IF NOT EXISTS metal_country_of_origin VARCHAR(100), -- country where metal was manufactured
  ADD COLUMN IF NOT EXISTS metal_manufacturer VARCHAR(255), -- manufacturer/mill name
  ADD COLUMN IF NOT EXISTS is_scrap_material BOOLEAN DEFAULT FALSE, -- whether this is scrap/waste material
  ADD COLUMN IF NOT EXISTS metal_surface_treatment VARCHAR(100); -- e.g., 'Polished', 'Brushed', 'Sandblasted'

-- Create indexes for commonly queried metal fields
CREATE INDEX IF NOT EXISTS idx_products_metal_grade ON products(metal_grade);
CREATE INDEX IF NOT EXISTS idx_products_metal_alloy_type ON products(metal_alloy_type);
CREATE INDEX IF NOT EXISTS idx_products_metal_form ON products(metal_form);
CREATE INDEX IF NOT EXISTS idx_products_is_scrap_material ON products(is_scrap_material);

-- Add comment to document the purpose of these columns
COMMENT ON COLUMN products.metal_grade IS 'Metal grade specification (e.g., A36, 304, 316L for steel grades)';
COMMENT ON COLUMN products.metal_alloy_type IS 'Type of metal alloy (e.g., Carbon Steel, Stainless Steel, Aluminum)';
COMMENT ON COLUMN products.metal_form IS 'Physical form of metal product (e.g., Sheet, Plate, Rod, Tube, Coil)';
COMMENT ON COLUMN products.weight_per_unit IS 'Weight in kg per single unit of measurement';
COMMENT ON COLUMN products.metal_certification IS 'Quality certifications and standards compliance';

-- Create a view for metal products with calculated weight
CREATE OR REPLACE VIEW metal_products_with_weight AS
SELECT 
  p.*,
  CASE 
    WHEN p.weight_per_unit IS NOT NULL THEN p.weight_per_unit
    WHEN p.metal_form = 'Sheet' AND p.metal_thickness IS NOT NULL 
      AND p.metal_width IS NOT NULL AND p.metal_length IS NOT NULL 
      AND p.metal_density IS NOT NULL 
      THEN (p.metal_thickness / 1000) * (p.metal_width / 1000) * (p.metal_length / 1000) * p.metal_density
    ELSE NULL
  END as calculated_weight_kg,
  pc.name as category_name,
  psc.name as sub_category_name
FROM products p
LEFT JOIN product_categories pc ON p.product_category_id = pc.id
LEFT JOIN product_sub_categories psc ON p.product_sub_category_id = psc.id
WHERE p.product_type = 'storable';

-- Insert default metal categories if they don't exist
INSERT INTO product_categories (erp_organization_id, name, code, description, is_active)
SELECT 
  org.id,
  'Steel Products',
  'STEEL',
  'All types of steel products including sheets, plates, rods, and tubes',
  true
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories 
  WHERE name = 'Steel Products' AND erp_organization_id = org.id
);

INSERT INTO product_categories (erp_organization_id, name, code, description, is_active)
SELECT 
  org.id,
  'Aluminum Products',
  'ALUM',
  'All types of aluminum products and alloys',
  true
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories 
  WHERE name = 'Aluminum Products' AND erp_organization_id = org.id
);

INSERT INTO product_categories (erp_organization_id, name, code, description, is_active)
SELECT 
  org.id,
  'Copper Products',
  'COPPER',
  'All types of copper products and alloys',
  true
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories 
  WHERE name = 'Copper Products' AND erp_organization_id = org.id
);

INSERT INTO product_categories (erp_organization_id, name, code, description, is_active)
SELECT 
  org.id,
  'Stainless Steel',
  'SS',
  'All grades of stainless steel products',
  true
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories 
  WHERE name = 'Stainless Steel' AND erp_organization_id = org.id
);

INSERT INTO product_categories (erp_organization_id, name, code, description, is_active)
SELECT 
  org.id,
  'Scrap Materials',
  'SCRAP',
  'Scrap and waste metal materials',
  true
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories 
  WHERE name = 'Scrap Materials' AND erp_organization_id = org.id
);

-- Add metal-specific units of measure
INSERT INTO units_of_measure (erp_organization_id, name, code, uom_type, is_base_unit, conversion_factor)
SELECT 
  org.id,
  'Kilogram',
  'KG',
  'weight',
  true,
  1.0
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM units_of_measure 
  WHERE code = 'KG' AND erp_organization_id = org.id
);

INSERT INTO units_of_measure (erp_organization_id, name, code, uom_type, is_base_unit, conversion_factor)
SELECT 
  org.id,
  'Metric Ton',
  'TON',
  'weight',
  false,
  1000.0
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM units_of_measure 
  WHERE code = 'TON' AND erp_organization_id = org.id
);

INSERT INTO units_of_measure (erp_organization_id, name, code, uom_type, is_base_unit, conversion_factor)
SELECT 
  org.id,
  'Meter',
  'MTR',
  'length',
  true,
  1.0
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM units_of_measure 
  WHERE code = 'MTR' AND erp_organization_id = org.id
);

INSERT INTO units_of_measure (erp_organization_id, name, code, uom_type, is_base_unit, conversion_factor)
SELECT 
  org.id,
  'Piece',
  'PC',
  'unit',
  true,
  1.0
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM units_of_measure 
  WHERE code = 'PC' AND erp_organization_id = org.id
);

INSERT INTO units_of_measure (erp_organization_id, name, code, uom_type, is_base_unit, conversion_factor)
SELECT 
  org.id,
  'Square Meter',
  'SQM',
  'area',
  true,
  1.0
FROM erp_organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM units_of_measure 
  WHERE code = 'SQM' AND erp_organization_id = org.id
);

-- Update the schema comment
COMMENT ON TABLE products IS 'Products table with metal-specific attributes for Leo Metals ERP';

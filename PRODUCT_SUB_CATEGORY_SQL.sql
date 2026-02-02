-- ============================================
-- PRODUCT SUB-CATEGORY TABLE
-- Run this SQL in PGAdmin directly
-- ============================================

-- Create product sub-categories table
CREATE TABLE product_sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
  product_category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(erp_organization_id, code),
  UNIQUE(product_category_id, name)
);

-- Add sub_category_id to products table
ALTER TABLE products 
ADD COLUMN product_sub_category_id UUID REFERENCES product_sub_categories(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_product_sub_categories_category_id ON product_sub_categories(product_category_id);
CREATE INDEX idx_products_sub_category_id ON products(product_sub_category_id);

-- Add comment
COMMENT ON TABLE product_sub_categories IS 'Product sub-categories linked to main categories';
COMMENT ON COLUMN products.product_sub_category_id IS 'Optional sub-category for more specific classification';

-- Insert sample data (optional - remove if not needed)
-- INSERT INTO product_sub_categories (erp_organization_id, product_category_id, name, code, description)
-- SELECT 
--   pc.erp_organization_id,
--   pc.id,
--   'General',
--   CONCAT(pc.code, '-GEN'),
--   'General sub-category for ' || pc.name
-- FROM product_categories pc
-- LIMIT 5;

-- Verify creation
SELECT 
  COUNT(*) as subcategory_count,
  'product_sub_categories table created successfully' as status
FROM product_sub_categories;

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'product_sub_categories'
ORDER BY ordinal_position;

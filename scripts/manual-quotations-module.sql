-- Create manual_quotations table for storing manually created quotation details
-- This table normalizes manual quotation data instead of storing in JSONB

CREATE TABLE IF NOT EXISTS manual_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES supplier_quotation_submissions(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    erp_organization_id UUID NOT NULL,
    
    -- Quotation details
    notes TEXT,
    terms TEXT,
    payment_terms VARCHAR(255),
    delivery_terms VARCHAR(255),
    validity_days INTEGER DEFAULT 30,
    
    -- Totals
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    shipping_charges DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT fk_manual_quotation_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_manual_quotation_erp_org FOREIGN KEY (erp_organization_id) REFERENCES erp_organizations(id)
);

-- Create manual_quotation_items table for line items
CREATE TABLE IF NOT EXISTS manual_quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manual_quotation_id UUID NOT NULL REFERENCES manual_quotations(id) ON DELETE CASCADE,
    
    -- Product details
    product_name VARCHAR(500) NOT NULL,
    product_code VARCHAR(100),
    description TEXT,
    
    -- Quantity and pricing
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    line_total DECIMAL(12, 2) NOT NULL,
    
    -- Additional info
    unit_of_measure VARCHAR(50),
    delivery_time_days INTEGER,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_manual_quotations_quotation ON manual_quotations(quotation_id);
CREATE INDEX IF NOT EXISTS idx_manual_quotations_supplier ON manual_quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_manual_quotations_erp_org ON manual_quotations(erp_organization_id);
CREATE INDEX IF NOT EXISTS idx_manual_quotation_items_quotation ON manual_quotation_items(manual_quotation_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_manual_quotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_manual_quotations_timestamp
    BEFORE UPDATE ON manual_quotations
    FOR EACH ROW
    EXECUTE FUNCTION update_manual_quotations_updated_at();

CREATE TRIGGER trigger_update_manual_quotation_items_timestamp
    BEFORE UPDATE ON manual_quotation_items
    FOR EACH ROW
    EXECUTE FUNCTION update_manual_quotations_updated_at();

-- Add comments for documentation
COMMENT ON TABLE manual_quotations IS 'Stores detailed information for manually created quotations';
COMMENT ON TABLE manual_quotation_items IS 'Line items for manual quotations';
COMMENT ON COLUMN manual_quotations.quotation_id IS 'Reference to the main quotation submission';
COMMENT ON COLUMN manual_quotations.total_amount IS 'Total quotation amount including taxes and charges';
COMMENT ON COLUMN manual_quotation_items.line_total IS 'Total for this line item (quantity * unit_price - discount + tax)';

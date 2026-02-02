-- ============================================
-- BILLING & FINANCE MODULE - COMPLETE SCHEMA
-- ============================================

-- 1. CHART OF ACCOUNTS
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- 'asset', 'liability', 'equity', 'revenue', 'expense'
    account_subtype VARCHAR(100), -- 'current_asset', 'fixed_asset', 'accounts_receivable', etc.
    parent_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    is_system_account BOOLEAN DEFAULT false, -- Cannot be deleted
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(erp_organization_id, account_code)
);

CREATE INDEX idx_coa_organization ON chart_of_accounts(erp_organization_id);
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id);

-- 2. GENERAL LEDGER
CREATE TABLE IF NOT EXISTS general_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    journal_entry_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    transaction_date DATE NOT NULL,
    posting_date DATE NOT NULL,
    reference_type VARCHAR(50), -- 'sales_invoice', 'purchase_bill', 'payment', 'journal', etc.
    reference_id UUID,
    description TEXT,
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    status VARCHAR(20) DEFAULT 'posted', -- 'draft', 'posted', 'reversed'
    fiscal_year INTEGER NOT NULL,
    fiscal_period INTEGER NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gl_organization ON general_ledger(erp_organization_id);
CREATE INDEX idx_gl_account ON general_ledger(account_id);
CREATE INDEX idx_gl_journal ON general_ledger(journal_entry_id);
CREATE INDEX idx_gl_reference ON general_ledger(reference_type, reference_id);
CREATE INDEX idx_gl_date ON general_ledger(transaction_date);
CREATE INDEX idx_gl_period ON general_ledger(fiscal_year, fiscal_period);

-- 3. CUSTOMER INVOICES (Accounts Receivable)
CREATE TABLE IF NOT EXISTS customer_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    sales_order_id UUID REFERENCES sales_orders(id),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    subtotal DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    outstanding_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'
    notes TEXT,
    terms_and_conditions TEXT,
    gl_posted BOOLEAN DEFAULT false,
    gl_journal_entry_id UUID,
    created_by UUID,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(erp_organization_id, invoice_number)
);

CREATE INDEX idx_customer_invoices_org ON customer_invoices(erp_organization_id);
CREATE INDEX idx_customer_invoices_customer ON customer_invoices(customer_id);
CREATE INDEX idx_customer_invoices_so ON customer_invoices(sales_order_id);
CREATE INDEX idx_customer_invoices_status ON customer_invoices(status);
CREATE INDEX idx_customer_invoices_date ON customer_invoices(invoice_date);

-- 4. CUSTOMER INVOICE LINES
CREATE TABLE IF NOT EXISTS customer_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id), -- Revenue account
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_lines_invoice ON customer_invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_product ON customer_invoice_lines(product_id);

-- 5. CUSTOMER PAYMENTS
CREATE TABLE IF NOT EXISTS customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    payment_number VARCHAR(50) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    payment_method VARCHAR(50), -- 'cash', 'check', 'bank_transfer', 'credit_card', 'online'
    reference_number VARCHAR(100),
    bank_account_id UUID,
    notes TEXT,
    gl_posted BOOLEAN DEFAULT false,
    gl_journal_entry_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(erp_organization_id, payment_number)
);

CREATE INDEX idx_customer_payments_org ON customer_payments(erp_organization_id);
CREATE INDEX idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX idx_customer_payments_date ON customer_payments(payment_date);

-- 6. PAYMENT ALLOCATIONS (Link payments to invoices)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_invoice ON payment_allocations(invoice_id);

-- 7. VENDOR BILLS (Accounts Payable)
CREATE TABLE IF NOT EXISTS vendor_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    bill_number VARCHAR(50) NOT NULL,
    vendor_bill_number VARCHAR(100), -- Vendor's invoice number
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    bill_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    subtotal DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    outstanding_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'approved', 'partially_paid', 'paid', 'overdue', 'cancelled'
    notes TEXT,
    gl_posted BOOLEAN DEFAULT false,
    gl_journal_entry_id UUID,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(erp_organization_id, bill_number)
);

CREATE INDEX idx_vendor_bills_org ON vendor_bills(erp_organization_id);
CREATE INDEX idx_vendor_bills_supplier ON vendor_bills(supplier_id);
CREATE INDEX idx_vendor_bills_po ON vendor_bills(purchase_order_id);
CREATE INDEX idx_vendor_bills_status ON vendor_bills(status);
CREATE INDEX idx_vendor_bills_date ON vendor_bills(bill_date);

-- 8. VENDOR BILL LINES
CREATE TABLE IF NOT EXISTS vendor_bill_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES vendor_bills(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id), -- Expense account
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bill_lines_bill ON vendor_bill_lines(bill_id);
CREATE INDEX idx_bill_lines_product ON vendor_bill_lines(product_id);

-- 9. VENDOR PAYMENTS
CREATE TABLE IF NOT EXISTS vendor_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    payment_number VARCHAR(50) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    bank_account_id UUID,
    notes TEXT,
    gl_posted BOOLEAN DEFAULT false,
    gl_journal_entry_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(erp_organization_id, payment_number)
);

CREATE INDEX idx_vendor_payments_org ON vendor_payments(erp_organization_id);
CREATE INDEX idx_vendor_payments_supplier ON vendor_payments(supplier_id);
CREATE INDEX idx_vendor_payments_date ON vendor_payments(payment_date);

-- 10. VENDOR PAYMENT ALLOCATIONS
CREATE TABLE IF NOT EXISTS vendor_payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES vendor_payments(id) ON DELETE CASCADE,
    bill_id UUID NOT NULL REFERENCES vendor_bills(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_payment_allocations_payment ON vendor_payment_allocations(payment_id);
CREATE INDEX idx_vendor_payment_allocations_bill ON vendor_payment_allocations(bill_id);

-- 11. BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    account_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    account_type VARCHAR(50), -- 'checking', 'savings', 'credit_card'
    currency VARCHAR(10) DEFAULT 'INR',
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    gl_account_id UUID REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_org ON bank_accounts(erp_organization_id);

-- 12. BANK TRANSACTIONS
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT,
    reference VARCHAR(100),
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    balance DECIMAL(15,2),
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_date DATE,
    gl_posted BOOLEAN DEFAULT false,
    gl_journal_entry_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_reconciled ON bank_transactions(is_reconciled);

-- 13. TAX CODES
CREATE TABLE IF NOT EXISTS tax_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    tax_code VARCHAR(50) NOT NULL,
    tax_name VARCHAR(255) NOT NULL,
    tax_type VARCHAR(50) NOT NULL, -- 'sales_tax', 'purchase_tax', 'vat', 'gst', 'withholding'
    rate DECIMAL(5,2) NOT NULL,
    is_compound BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    tax_account_id UUID REFERENCES chart_of_accounts(id),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(erp_organization_id, tax_code)
);

CREATE INDEX idx_tax_codes_org ON tax_codes(erp_organization_id);
CREATE INDEX idx_tax_codes_type ON tax_codes(tax_type);

-- 14. FIXED ASSETS
CREATE TABLE IF NOT EXISTS fixed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    asset_code VARCHAR(50) NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    asset_category VARCHAR(100),
    purchase_date DATE NOT NULL,
    purchase_cost DECIMAL(15,2) NOT NULL,
    salvage_value DECIMAL(15,2) DEFAULT 0,
    useful_life_years INTEGER NOT NULL,
    depreciation_method VARCHAR(50) DEFAULT 'straight_line', -- 'straight_line', 'declining_balance', 'sum_of_years_digits'
    accumulated_depreciation DECIMAL(15,2) DEFAULT 0,
    book_value DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'disposed', 'fully_depreciated'
    disposal_date DATE,
    disposal_value DECIMAL(15,2),
    asset_account_id UUID REFERENCES chart_of_accounts(id),
    depreciation_account_id UUID REFERENCES chart_of_accounts(id),
    location VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(erp_organization_id, asset_code)
);

CREATE INDEX idx_fixed_assets_org ON fixed_assets(erp_organization_id);
CREATE INDEX idx_fixed_assets_status ON fixed_assets(status);

-- 15. DEPRECIATION SCHEDULE
CREATE TABLE IF NOT EXISTS depreciation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    depreciation_amount DECIMAL(15,2) NOT NULL,
    accumulated_depreciation DECIMAL(15,2) NOT NULL,
    book_value DECIMAL(15,2) NOT NULL,
    is_posted BOOLEAN DEFAULT false,
    gl_journal_entry_id UUID,
    posted_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_depreciation_schedules_asset ON depreciation_schedules(asset_id);
CREATE INDEX idx_depreciation_schedules_date ON depreciation_schedules(period_end_date);
CREATE INDEX idx_depreciation_schedules_posted ON depreciation_schedules(is_posted);

-- 16. BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    budget_name VARCHAR(255) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    budget_type VARCHAR(50) DEFAULT 'annual', -- 'annual', 'quarterly', 'monthly'
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'closed'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budgets_org ON budgets(erp_organization_id);
CREATE INDEX idx_budgets_year ON budgets(fiscal_year);

-- 17. BUDGET LINES
CREATE TABLE IF NOT EXISTS budget_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    period INTEGER NOT NULL, -- 1-12 for months, 1-4 for quarters
    budgeted_amount DECIMAL(15,2) NOT NULL,
    actual_amount DECIMAL(15,2) DEFAULT 0,
    variance DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budget_lines_budget ON budget_lines(budget_id);
CREATE INDEX idx_budget_lines_account ON budget_lines(account_id);

-- 18. RECURRING INVOICES
CREATE TABLE IF NOT EXISTS recurring_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    invoice_template TEXT NOT NULL, -- JSON template for invoice
    frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
    start_date DATE NOT NULL,
    end_date DATE,
    next_invoice_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recurring_invoices_org ON recurring_invoices(erp_organization_id);
CREATE INDEX idx_recurring_invoices_customer ON recurring_invoices(customer_id);
CREATE INDEX idx_recurring_invoices_next_date ON recurring_invoices(next_invoice_date);

-- 19. FISCAL PERIODS
CREATE TABLE IF NOT EXISTS fiscal_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    period_number INTEGER NOT NULL,
    period_name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed', 'locked'
    closed_by UUID,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(erp_organization_id, fiscal_year, period_number)
);

CREATE INDEX idx_fiscal_periods_org ON fiscal_periods(erp_organization_id);
CREATE INDEX idx_fiscal_periods_year ON fiscal_periods(fiscal_year);
CREATE INDEX idx_fiscal_periods_status ON fiscal_periods(status);

-- 20. AUDIT LOG (Finance specific)
CREATE TABLE IF NOT EXISTS finance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_organization_id UUID NOT NULL REFERENCES erp_organizations(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete', 'post', 'reverse'
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_finance_audit_org ON finance_audit_log(erp_organization_id);
CREATE INDEX idx_finance_audit_table ON finance_audit_log(table_name, record_id);
CREATE INDEX idx_finance_audit_user ON finance_audit_log(user_id);
CREATE INDEX idx_finance_audit_date ON finance_audit_log(created_at);

-- Add comments
COMMENT ON TABLE chart_of_accounts IS 'Chart of accounts for general ledger';
COMMENT ON TABLE general_ledger IS 'All financial transactions posted to GL';
COMMENT ON TABLE customer_invoices IS 'Customer invoices (Accounts Receivable)';
COMMENT ON TABLE customer_payments IS 'Customer payments received';
COMMENT ON TABLE vendor_bills IS 'Vendor bills (Accounts Payable)';
COMMENT ON TABLE vendor_payments IS 'Payments made to vendors';
COMMENT ON TABLE bank_accounts IS 'Company bank accounts';
COMMENT ON TABLE tax_codes IS 'Tax codes for sales and purchase taxes';
COMMENT ON TABLE fixed_assets IS 'Fixed assets register';
COMMENT ON TABLE budgets IS 'Annual/periodic budgets';
COMMENT ON TABLE recurring_invoices IS 'Recurring invoice templates for subscriptions';
COMMENT ON TABLE fiscal_periods IS 'Fiscal year periods for accounting';
COMMENT ON TABLE finance_audit_log IS 'Audit trail for all finance transactions';

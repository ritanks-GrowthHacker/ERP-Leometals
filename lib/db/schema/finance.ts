import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { erpOrganizations } from './core';
import { customers, salesOrders } from './purchasing-sales';
import { suppliers, purchaseOrders } from './purchasing-sales';
import { products } from './inventory';

// 1. CHART OF ACCOUNTS
export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  accountCode: varchar('account_code', { length: 50 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountType: varchar('account_type', { length: 50 }).notNull(), // 'asset', 'liability', 'equity', 'revenue', 'expense'
  accountSubtype: varchar('account_subtype', { length: 100 }),
  parentAccountId: uuid('parent_account_id'),
  currency: varchar('currency', { length: 10 }).default('INR'),
  isActive: boolean('is_active').default(true),
  isSystemAccount: boolean('is_system_account').default(false),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqOrgCode: unique().on(table.erpOrganizationId, table.accountCode),
  orgIdx: index('idx_coa_organization').on(table.erpOrganizationId),
  typeIdx: index('idx_coa_type').on(table.accountType),
  parentIdx: index('idx_coa_parent').on(table.parentAccountId),
}));

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [chartOfAccounts.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  parentAccount: one(chartOfAccounts, {
    fields: [chartOfAccounts.parentAccountId],
    references: [chartOfAccounts.id],
    relationName: 'account_hierarchy',
  }),
  childAccounts: many(chartOfAccounts, { relationName: 'account_hierarchy' }),
  glEntries: many(generalLedger),
  budgetLines: many(budgetLines),
}));

// 2. GENERAL LEDGER
export const generalLedger = pgTable('general_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  journalEntryId: uuid('journal_entry_id').notNull(),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  transactionDate: date('transaction_date').notNull(),
  postingDate: date('posting_date').notNull(),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),
  description: text('description'),
  debitAmount: decimal('debit_amount', { precision: 15, scale: 2 }).default('0'),
  creditAmount: decimal('credit_amount', { precision: 15, scale: 2 }).default('0'),
  currency: varchar('currency', { length: 10 }).default('INR'),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 4 }).default('1'),
  status: varchar('status', { length: 20 }).default('posted'),
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalPeriod: integer('fiscal_period').notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('idx_gl_organization').on(table.erpOrganizationId),
  accountIdx: index('idx_gl_account').on(table.accountId),
  journalIdx: index('idx_gl_journal').on(table.journalEntryId),
  referenceIdx: index('idx_gl_reference').on(table.referenceType, table.referenceId),
  dateIdx: index('idx_gl_date').on(table.transactionDate),
  periodIdx: index('idx_gl_period').on(table.fiscalYear, table.fiscalPeriod),
}));

export const generalLedgerRelations = relations(generalLedger, ({ one }) => ({
  organization: one(erpOrganizations, {
    fields: [generalLedger.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  account: one(chartOfAccounts, {
    fields: [generalLedger.accountId],
    references: [chartOfAccounts.id],
  }),
}));

// 3. CUSTOMER INVOICES
export const customerInvoices = pgTable('customer_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  salesOrderId: uuid('sales_order_id').references(() => salesOrders.id),
  invoiceDate: date('invoice_date').notNull(),
  dueDate: date('due_date').notNull(),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  currency: varchar('currency', { length: 10 }).default('INR'),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 4 }).default('1'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 15, scale: 2 }).default('0'),
  outstandingAmount: decimal('outstanding_amount', { precision: 15, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft'),
  notes: text('notes'),
  termsAndConditions: text('terms_and_conditions'),
  glPosted: boolean('gl_posted').default(false),
  glJournalEntryId: uuid('gl_journal_entry_id'),
  createdBy: uuid('created_by'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqInvoiceNumber: unique().on(table.erpOrganizationId, table.invoiceNumber),
  orgIdx: index('idx_customer_invoices_org').on(table.erpOrganizationId),
  customerIdx: index('idx_customer_invoices_customer').on(table.customerId),
  soIdx: index('idx_customer_invoices_so').on(table.salesOrderId),
  statusIdx: index('idx_customer_invoices_status').on(table.status),
  dateIdx: index('idx_customer_invoices_date').on(table.invoiceDate),
}));

export const customerInvoicesRelations = relations(customerInvoices, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [customerInvoices.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  customer: one(customers, {
    fields: [customerInvoices.customerId],
    references: [customers.id],
  }),
  salesOrder: one(salesOrders, {
    fields: [customerInvoices.salesOrderId],
    references: [salesOrders.id],
  }),
  lines: many(customerInvoiceLines),
  paymentAllocations: many(paymentAllocations),
}));

// 4. CUSTOMER INVOICE LINES
export const customerInvoiceLines = pgTable('customer_invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => customerInvoices.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 15, scale: 3 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  lineTotal: decimal('line_total', { precision: 15, scale: 2 }).notNull(),
  accountId: uuid('account_id').references(() => chartOfAccounts.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  invoiceIdx: index('idx_invoice_lines_invoice').on(table.invoiceId),
  productIdx: index('idx_invoice_lines_product').on(table.productId),
}));

export const customerInvoiceLinesRelations = relations(customerInvoiceLines, ({ one }) => ({
  invoice: one(customerInvoices, {
    fields: [customerInvoiceLines.invoiceId],
    references: [customerInvoices.id],
  }),
  product: one(products, {
    fields: [customerInvoiceLines.productId],
    references: [products.id],
  }),
  account: one(chartOfAccounts, {
    fields: [customerInvoiceLines.accountId],
    references: [chartOfAccounts.id],
  }),
}));

// 5. CUSTOMER PAYMENTS
export const customerPayments = pgTable('customer_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  paymentNumber: varchar('payment_number', { length: 50 }).notNull(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  paymentDate: date('payment_date').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('INR'),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 4 }).default('1'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  bankAccountId: uuid('bank_account_id'),
  notes: text('notes'),
  glPosted: boolean('gl_posted').default(false),
  glJournalEntryId: uuid('gl_journal_entry_id'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqPaymentNumber: unique().on(table.erpOrganizationId, table.paymentNumber),
  orgIdx: index('idx_customer_payments_org').on(table.erpOrganizationId),
  customerIdx: index('idx_customer_payments_customer').on(table.customerId),
  dateIdx: index('idx_customer_payments_date').on(table.paymentDate),
}));

export const customerPaymentsRelations = relations(customerPayments, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [customerPayments.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  customer: one(customers, {
    fields: [customerPayments.customerId],
    references: [customers.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [customerPayments.bankAccountId],
    references: [bankAccounts.id],
  }),
  allocations: many(paymentAllocations),
}));

// 6. PAYMENT ALLOCATIONS
export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => customerPayments.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => customerInvoices.id, { onDelete: 'cascade' }),
  allocatedAmount: decimal('allocated_amount', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  paymentIdx: index('idx_payment_allocations_payment').on(table.paymentId),
  invoiceIdx: index('idx_payment_allocations_invoice').on(table.invoiceId),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(customerPayments, {
    fields: [paymentAllocations.paymentId],
    references: [customerPayments.id],
  }),
  invoice: one(customerInvoices, {
    fields: [paymentAllocations.invoiceId],
    references: [customerInvoices.id],
  }),
}));

// 7. VENDOR BILLS
export const vendorBills = pgTable('vendor_bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  billNumber: varchar('bill_number', { length: 50 }).notNull(),
  vendorBillNumber: varchar('vendor_bill_number', { length: 100 }),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
  billDate: date('bill_date').notNull(),
  dueDate: date('due_date').notNull(),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  currency: varchar('currency', { length: 10 }).default('INR'),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 4 }).default('1'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 15, scale: 2 }).default('0'),
  outstandingAmount: decimal('outstanding_amount', { precision: 15, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft'),
  notes: text('notes'),
  glPosted: boolean('gl_posted').default(false),
  glJournalEntryId: uuid('gl_journal_entry_id'),
  createdBy: uuid('created_by'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqBillNumber: unique().on(table.erpOrganizationId, table.billNumber),
  orgIdx: index('idx_vendor_bills_org').on(table.erpOrganizationId),
  supplierIdx: index('idx_vendor_bills_supplier').on(table.supplierId),
  poIdx: index('idx_vendor_bills_po').on(table.purchaseOrderId),
  statusIdx: index('idx_vendor_bills_status').on(table.status),
  dateIdx: index('idx_vendor_bills_date').on(table.billDate),
}));

export const vendorBillsRelations = relations(vendorBills, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [vendorBills.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  supplier: one(suppliers, {
    fields: [vendorBills.supplierId],
    references: [suppliers.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [vendorBills.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  lines: many(vendorBillLines),
  paymentAllocations: many(vendorPaymentAllocations),
}));

// 8. VENDOR BILL LINES
export const vendorBillLines = pgTable('vendor_bill_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').notNull().references(() => vendorBills.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 15, scale: 3 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  lineTotal: decimal('line_total', { precision: 15, scale: 2 }).notNull(),
  accountId: uuid('account_id').references(() => chartOfAccounts.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  billIdx: index('idx_bill_lines_bill').on(table.billId),
  productIdx: index('idx_bill_lines_product').on(table.productId),
}));

export const vendorBillLinesRelations = relations(vendorBillLines, ({ one }) => ({
  bill: one(vendorBills, {
    fields: [vendorBillLines.billId],
    references: [vendorBills.id],
  }),
  product: one(products, {
    fields: [vendorBillLines.productId],
    references: [products.id],
  }),
  account: one(chartOfAccounts, {
    fields: [vendorBillLines.accountId],
    references: [chartOfAccounts.id],
  }),
}));

// 9. VENDOR PAYMENTS
export const vendorPayments = pgTable('vendor_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  paymentNumber: varchar('payment_number', { length: 50 }).notNull(),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
  paymentDate: date('payment_date').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('INR'),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 4 }).default('1'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  bankAccountId: uuid('bank_account_id'),
  notes: text('notes'),
  glPosted: boolean('gl_posted').default(false),
  glJournalEntryId: uuid('gl_journal_entry_id'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqPaymentNumber: unique().on(table.erpOrganizationId, table.paymentNumber),
  orgIdx: index('idx_vendor_payments_org').on(table.erpOrganizationId),
  supplierIdx: index('idx_vendor_payments_supplier').on(table.supplierId),
  dateIdx: index('idx_vendor_payments_date').on(table.paymentDate),
}));

export const vendorPaymentsRelations = relations(vendorPayments, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [vendorPayments.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  supplier: one(suppliers, {
    fields: [vendorPayments.supplierId],
    references: [suppliers.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [vendorPayments.bankAccountId],
    references: [bankAccounts.id],
  }),
  allocations: many(vendorPaymentAllocations),
}));

// 10. VENDOR PAYMENT ALLOCATIONS
export const vendorPaymentAllocations = pgTable('vendor_payment_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => vendorPayments.id, { onDelete: 'cascade' }),
  billId: uuid('bill_id').notNull().references(() => vendorBills.id, { onDelete: 'cascade' }),
  allocatedAmount: decimal('allocated_amount', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  paymentIdx: index('idx_vendor_payment_allocations_payment').on(table.paymentId),
  billIdx: index('idx_vendor_payment_allocations_bill').on(table.billId),
}));

export const vendorPaymentAllocationsRelations = relations(vendorPaymentAllocations, ({ one }) => ({
  payment: one(vendorPayments, {
    fields: [vendorPaymentAllocations.paymentId],
    references: [vendorPayments.id],
  }),
  bill: one(vendorBills, {
    fields: [vendorPaymentAllocations.billId],
    references: [vendorBills.id],
  }),
}));

// 11. BANK ACCOUNTS
export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  bankName: varchar('bank_name', { length: 255 }).notNull(),
  accountNumber: varchar('account_number', { length: 100 }).notNull(),
  accountType: varchar('account_type', { length: 50 }),
  currency: varchar('currency', { length: 10 }).default('INR'),
  openingBalance: decimal('opening_balance', { precision: 15, scale: 2 }).default('0'),
  currentBalance: decimal('current_balance', { precision: 15, scale: 2 }).default('0'),
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('idx_bank_accounts_org').on(table.erpOrganizationId),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [bankAccounts.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  glAccount: one(chartOfAccounts, {
    fields: [bankAccounts.glAccountId],
    references: [chartOfAccounts.id],
  }),
  transactions: many(bankTransactions),
  customerPayments: many(customerPayments),
  vendorPayments: many(vendorPayments),
}));

// 12. BANK TRANSACTIONS
export const bankTransactions = pgTable('bank_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  bankAccountId: uuid('bank_account_id').notNull().references(() => bankAccounts.id, { onDelete: 'cascade' }),
  transactionDate: date('transaction_date').notNull(),
  description: text('description'),
  reference: varchar('reference', { length: 100 }),
  debitAmount: decimal('debit_amount', { precision: 15, scale: 2 }).default('0'),
  creditAmount: decimal('credit_amount', { precision: 15, scale: 2 }).default('0'),
  balance: decimal('balance', { precision: 15, scale: 2 }),
  isReconciled: boolean('is_reconciled').default(false),
  reconciledDate: date('reconciled_date'),
  glPosted: boolean('gl_posted').default(false),
  glJournalEntryId: uuid('gl_journal_entry_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  accountIdx: index('idx_bank_transactions_account').on(table.bankAccountId),
  dateIdx: index('idx_bank_transactions_date').on(table.transactionDate),
  reconciledIdx: index('idx_bank_transactions_reconciled').on(table.isReconciled),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  bankAccount: one(bankAccounts, {
    fields: [bankTransactions.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

// 13. TAX CODES
export const taxCodes = pgTable('tax_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  taxCode: varchar('tax_code', { length: 50 }).notNull(),
  taxName: varchar('tax_name', { length: 255 }).notNull(),
  taxType: varchar('tax_type', { length: 50 }).notNull(),
  rate: decimal('rate', { precision: 5, scale: 2 }).notNull(),
  isCompound: boolean('is_compound').default(false),
  isActive: boolean('is_active').default(true),
  taxAccountId: uuid('tax_account_id').references(() => chartOfAccounts.id),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqTaxCode: unique().on(table.erpOrganizationId, table.taxCode),
  orgIdx: index('idx_tax_codes_org').on(table.erpOrganizationId),
  typeIdx: index('idx_tax_codes_type').on(table.taxType),
}));

export const taxCodesRelations = relations(taxCodes, ({ one }) => ({
  organization: one(erpOrganizations, {
    fields: [taxCodes.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  taxAccount: one(chartOfAccounts, {
    fields: [taxCodes.taxAccountId],
    references: [chartOfAccounts.id],
  }),
}));

// 14. FIXED ASSETS
export const fixedAssets = pgTable('fixed_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  assetCode: varchar('asset_code', { length: 50 }).notNull(),
  assetName: varchar('asset_name', { length: 255 }).notNull(),
  assetCategory: varchar('asset_category', { length: 100 }),
  purchaseDate: date('purchase_date').notNull(),
  purchaseCost: decimal('purchase_cost', { precision: 15, scale: 2 }).notNull(),
  salvageValue: decimal('salvage_value', { precision: 15, scale: 2 }).default('0'),
  usefulLifeYears: integer('useful_life_years').notNull(),
  depreciationMethod: varchar('depreciation_method', { length: 50 }).default('straight_line'),
  accumulatedDepreciation: decimal('accumulated_depreciation', { precision: 15, scale: 2 }).default('0'),
  bookValue: decimal('book_value', { precision: 15, scale: 2 }),
  status: varchar('status', { length: 20 }).default('active'),
  disposalDate: date('disposal_date'),
  disposalValue: decimal('disposal_value', { precision: 15, scale: 2 }),
  assetAccountId: uuid('asset_account_id').references(() => chartOfAccounts.id),
  depreciationAccountId: uuid('depreciation_account_id').references(() => chartOfAccounts.id),
  location: varchar('location', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqAssetCode: unique().on(table.erpOrganizationId, table.assetCode),
  orgIdx: index('idx_fixed_assets_org').on(table.erpOrganizationId),
  statusIdx: index('idx_fixed_assets_status').on(table.status),
}));

export const fixedAssetsRelations = relations(fixedAssets, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [fixedAssets.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  assetAccount: one(chartOfAccounts, {
    fields: [fixedAssets.assetAccountId],
    references: [chartOfAccounts.id],
    relationName: 'asset_account',
  }),
  depreciationAccount: one(chartOfAccounts, {
    fields: [fixedAssets.depreciationAccountId],
    references: [chartOfAccounts.id],
    relationName: 'depreciation_account',
  }),
  depreciationSchedules: many(depreciationSchedules),
}));

// 15. DEPRECIATION SCHEDULES
export const depreciationSchedules = pgTable('depreciation_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull().references(() => fixedAssets.id, { onDelete: 'cascade' }),
  periodStartDate: date('period_start_date').notNull(),
  periodEndDate: date('period_end_date').notNull(),
  depreciationAmount: decimal('depreciation_amount', { precision: 15, scale: 2 }).notNull(),
  accumulatedDepreciation: decimal('accumulated_depreciation', { precision: 15, scale: 2 }).notNull(),
  bookValue: decimal('book_value', { precision: 15, scale: 2 }).notNull(),
  isPosted: boolean('is_posted').default(false),
  glJournalEntryId: uuid('gl_journal_entry_id'),
  postedDate: date('posted_date'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  assetIdx: index('idx_depreciation_schedules_asset').on(table.assetId),
  dateIdx: index('idx_depreciation_schedules_date').on(table.periodEndDate),
  postedIdx: index('idx_depreciation_schedules_posted').on(table.isPosted),
}));

export const depreciationSchedulesRelations = relations(depreciationSchedules, ({ one }) => ({
  asset: one(fixedAssets, {
    fields: [depreciationSchedules.assetId],
    references: [fixedAssets.id],
  }),
}));

// 16. BUDGETS
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  budgetName: varchar('budget_name', { length: 255 }).notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  budgetType: varchar('budget_type', { length: 50 }).default('annual'),
  status: varchar('status', { length: 20 }).default('draft'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('idx_budgets_org').on(table.erpOrganizationId),
  yearIdx: index('idx_budgets_year').on(table.fiscalYear),
}));

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [budgets.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  lines: many(budgetLines),
}));

// 17. BUDGET LINES
export const budgetLines = pgTable('budget_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  period: integer('period').notNull(),
  budgetedAmount: decimal('budgeted_amount', { precision: 15, scale: 2 }).notNull(),
  actualAmount: decimal('actual_amount', { precision: 15, scale: 2 }).default('0'),
  variance: decimal('variance', { precision: 15, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  budgetIdx: index('idx_budget_lines_budget').on(table.budgetId),
  accountIdx: index('idx_budget_lines_account').on(table.accountId),
}));

export const budgetLinesRelations = relations(budgetLines, ({ one }) => ({
  budget: one(budgets, {
    fields: [budgetLines.budgetId],
    references: [budgets.id],
  }),
  account: one(chartOfAccounts, {
    fields: [budgetLines.accountId],
    references: [chartOfAccounts.id],
  }),
}));

// 18. RECURRING INVOICES
export const recurringInvoices = pgTable('recurring_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  invoiceTemplate: text('invoice_template').notNull(),
  frequency: varchar('frequency', { length: 20 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  nextInvoiceDate: date('next_invoice_date').notNull(),
  isActive: boolean('is_active').default(true),
  lastGeneratedAt: timestamp('last_generated_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('idx_recurring_invoices_org').on(table.erpOrganizationId),
  customerIdx: index('idx_recurring_invoices_customer').on(table.customerId),
  nextDateIdx: index('idx_recurring_invoices_next_date').on(table.nextInvoiceDate),
}));

export const recurringInvoicesRelations = relations(recurringInvoices, ({ one }) => ({
  organization: one(erpOrganizations, {
    fields: [recurringInvoices.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  customer: one(customers, {
    fields: [recurringInvoices.customerId],
    references: [customers.id],
  }),
}));

// 19. FISCAL PERIODS
export const fiscalPeriods = pgTable('fiscal_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  fiscalYear: integer('fiscal_year').notNull(),
  periodNumber: integer('period_number').notNull(),
  periodName: varchar('period_name', { length: 50 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: varchar('status', { length: 20 }).default('open'),
  closedBy: uuid('closed_by'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqPeriod: unique().on(table.erpOrganizationId, table.fiscalYear, table.periodNumber),
  orgIdx: index('idx_fiscal_periods_org').on(table.erpOrganizationId),
  yearIdx: index('idx_fiscal_periods_year').on(table.fiscalYear),
  statusIdx: index('idx_fiscal_periods_status').on(table.status),
}));

export const fiscalPeriodsRelations = relations(fiscalPeriods, ({ one }) => ({
  organization: one(erpOrganizations, {
    fields: [fiscalPeriods.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
}));

// 20. FINANCE AUDIT LOG
export const financeAuditLog = pgTable('finance_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  tableName: varchar('table_name', { length: 100 }).notNull(),
  recordId: uuid('record_id').notNull(),
  action: varchar('action', { length: 20 }).notNull(),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  userId: uuid('user_id'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgIdx: index('idx_finance_audit_org').on(table.erpOrganizationId),
  tableIdx: index('idx_finance_audit_table').on(table.tableName, table.recordId),
  userIdx: index('idx_finance_audit_user').on(table.userId),
  dateIdx: index('idx_finance_audit_date').on(table.createdAt),
}));

export const financeAuditLogRelations = relations(financeAuditLog, ({ one }) => ({
  organization: one(erpOrganizations, {
    fields: [financeAuditLog.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
}));

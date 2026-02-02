import { pgTable, uuid, varchar, text, timestamp, decimal, date, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { erpOrganizations } from './core';
import { products, productVariants, warehouses, warehouseLocations, unitsOfMeasure } from './inventory';

// ============================================
// SUPPLIERS & PURCHASING
// ============================================

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  website: varchar('website', { length: 255 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  taxId: varchar('tax_id', { length: 100 }),
  gstNumber: varchar('gst_number', { length: 15 }),
  panNumber: varchar('pan_number', { length: 10 }),
  gstState: varchar('gst_state', { length: 100 }),
  paymentTerms: integer('payment_terms').default(30),
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
  isActive: boolean('is_active').default(true),
  profileImage: text('profile_image'),
  otp: varchar('otp', { length: 10 }),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const supplierContacts = pgTable('supplier_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  position: varchar('position', { length: 100 }),
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Product-Supplier junction table for multi-vendor support
export const productSuppliers = pgTable('product_suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  supplierSku: varchar('supplier_sku', { length: 100 }),
  supplierProductName: varchar('supplier_product_name', { length: 255 }),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }),
  minimumOrderQuantity: decimal('minimum_order_quantity', { precision: 15, scale: 2 }).default('1'),
  leadTimeDays: integer('lead_time_days').default(0),
  isPrimary: boolean('is_primary').default(false),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id').references(() => warehouseLocations.id, { onDelete: 'restrict' }),
  poNumber: varchar('po_number', { length: 100 }).notNull(),
  poDate: date('po_date').notNull().defaultNow(),
  expectedDeliveryDate: date('expected_delivery_date'),
  status: varchar('status', { length: 50 }).default('draft'),
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  cgstAmount: decimal('cgst_amount', { precision: 15, scale: 2 }).default('0'),
  sgstAmount: decimal('sgst_amount', { precision: 15, scale: 2 }).default('0'),
  igstAmount: decimal('igst_amount', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).default('0'),
  gstNumber: varchar('gst_number', { length: 15 }),
  placeOfSupply: varchar('place_of_supply', { length: 100 }),
  paymentTerms: integer('payment_terms').default(30),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  approvedBy: uuid('approved_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  description: text('description'),
  quantityOrdered: decimal('quantity_ordered', { precision: 15, scale: 2 }).notNull(),
  quantityReceived: decimal('quantity_received', { precision: 15, scale: 2 }).default('0'),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  cgstRate: decimal('cgst_rate', { precision: 5, scale: 2 }).default('0'),
  sgstRate: decimal('sgst_rate', { precision: 5, scale: 2 }).default('0'),
  igstRate: decimal('igst_rate', { precision: 5, scale: 2 }).default('0'),
  cgstAmount: decimal('cgst_amount', { precision: 15, scale: 2 }).default('0'),
  sgstAmount: decimal('sgst_amount', { precision: 15, scale: 2 }).default('0'),
  igstAmount: decimal('igst_amount', { precision: 15, scale: 2 }).default('0'),
  hsnCode: varchar('hsn_code', { length: 20 }),
  expectedDeliveryDate: date('expected_delivery_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const purchaseOrderSuggestions = pgTable('purchase_order_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => warehouseLocations.id, { onDelete: 'cascade' }),
  suggestedQuantity: decimal('suggested_quantity', { precision: 15, scale: 2 }).notNull(),
  currentStock: decimal('current_stock', { precision: 15, scale: 2 }),
  reorderPoint: decimal('reorder_point', { precision: 15, scale: 2 }),
  averageDailyConsumption: decimal('average_daily_consumption', { precision: 15, scale: 2 }),
  daysOfStockRemaining: integer('days_of_stock_remaining'),
  estimatedStockoutDate: date('estimated_stockout_date'),
  priority: varchar('priority', { length: 20 }).default('normal'),
  status: varchar('status', { length: 20 }).default('pending'),
  notes: text('notes'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  poNumber: varchar('po_number', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});


export const vendorInvoices = pgTable('vendor_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'set null' }),
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  dueDate: date('due_date'),
  status: varchar('status', { length: 50 }).default('draft'),
  currencyCode: varchar('currency_code', { length: 3 }).default('INR'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  shippingCharges: decimal('shipping_charges', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  amountPaid: decimal('amount_paid', { precision: 15, scale: 2 }).default('0'),
  paymentTerms: integer('payment_terms').default(30),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  approvedBy: uuid('approved_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const vendorInvoiceLines = pgTable('vendor_invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorInvoiceId: uuid('vendor_invoice_id').notNull().references(() => vendorInvoices.id, { onDelete: 'cascade' }),
  purchaseOrderLineId: uuid('purchase_order_line_id').references(() => purchaseOrderLines.id, { onDelete: 'set null' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  description: text('description'),
  quantity: decimal('quantity', { precision: 15, scale: 2 }).notNull(),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0'),
  lineTotal: decimal('line_total', { precision: 15, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const goodsReceipts = pgTable('goods_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'restrict' }),
  receiptNumber: varchar('receipt_number', { length: 100 }).notNull(),
  receiptDate: date('receipt_date').notNull().defaultNow(),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
  deliveryNoteNumber: varchar('delivery_note_number', { length: 100 }),
  vehicleNumber: varchar('vehicle_number', { length: 50 }),
  driverName: varchar('driver_name', { length: 255 }),
  status: varchar('status', { length: 50 }).default('draft'),
  notes: text('notes'),
  receivedBy: uuid('received_by').notNull(),
  qualityCheckedBy: uuid('quality_checked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const goodsReceiptLines = pgTable('goods_receipt_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  goodsReceiptId: uuid('goods_receipt_id').notNull().references(() => goodsReceipts.id, { onDelete: 'cascade' }),
  purchaseOrderLineId: uuid('purchase_order_line_id').notNull().references(() => purchaseOrderLines.id, { onDelete: 'restrict' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  warehouseLocationId: uuid('warehouse_location_id').references(() => warehouses.id, { onDelete: 'set null' }),
  quantityOrdered: decimal('quantity_ordered', { precision: 15, scale: 2 }).notNull(),
  quantityReceived: decimal('quantity_received', { precision: 15, scale: 2 }).notNull(),
  quantityAccepted: decimal('quantity_accepted', { precision: 15, scale: 2 }).default('0'),
  quantityRejected: decimal('quantity_rejected', { precision: 15, scale: 2 }).default('0'),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  rejectionReason: text('rejection_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Supplier Quotation Submissions (from Supplier Portal)
export const supplierQuotationSubmissions = pgTable('supplier_quotation_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').references(() => requestForQuotations.id, { onDelete: 'set null' }),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'set null' }),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  submissionNumber: varchar('submission_number', { length: 100 }).notNull(),
  submissionDate: timestamp('submission_date', { withTimezone: true }).defaultNow(),
  submissionType: varchar('submission_type', { length: 20 }).default('quotation'), // quotation, revised_quotation
  quotationType: varchar('quotation_type', { length: 20 }).notNull(), // file_upload, manual_entry
  // For file uploads
  fileUrl: text('file_url'),
  fileName: varchar('file_name', { length: 255 }),
  fileType: varchar('file_type', { length: 50 }), // pdf, docx, jpg, png, etc.
  fileSize: integer('file_size'), // in bytes
  // For manual entry
  manualQuotationData: jsonb('manual_quotation_data'), // { items: [{product, qty, price, tax}], notes, terms }
  // Common fields
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }),
  currencyCode: varchar('currency_code', { length: 3 }).default('INR'),
  validUntil: date('valid_until'),
  deliveryTimeInDays: integer('delivery_time_in_days'),
  paymentTerms: text('payment_terms'),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).default('submitted'), // submitted, under_review, accepted, rejected
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// CUSTOMERS & SALES
// ============================================

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  website: varchar('website', { length: 255 }),
  billingAddress: text('billing_address'),
  shippingAddress: text('shipping_address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  taxId: varchar('tax_id', { length: 100 }),
  paymentTerms: integer('payment_terms').default(30),
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
  creditLimit: decimal('credit_limit', { precision: 15, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const customerContacts = pgTable('customer_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  position: varchar('position', { length: 100 }),
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'restrict' }),
  soNumber: varchar('so_number', { length: 100 }).notNull(),
  soDate: date('so_date').notNull().defaultNow(),
  expectedDeliveryDate: date('expected_delivery_date'),
  status: varchar('status', { length: 50 }).default('draft'),
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).default('0'),
  paymentTerms: integer('payment_terms').default(30),
  shippingAddress: text('shipping_address'),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  approvedBy: uuid('approved_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const salesOrderLines = pgTable('sales_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesOrderId: uuid('sales_order_id').notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  warehouseLocationId: uuid('warehouse_location_id').references(() => warehouseLocations.id, { onDelete: 'restrict' }),
  description: text('description'),
  quantityOrdered: decimal('quantity_ordered', { precision: 15, scale: 2 }).notNull(),
  quantityDelivered: decimal('quantity_delivered', { precision: 15, scale: 2 }).default('0'),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Sales Quotations
export const salesQuotations = pgTable('sales_quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  quotationNumber: varchar('quotation_number', { length: 100 }).notNull(),
  quotationDate: date('quotation_date').notNull().defaultNow(),
  validUntil: date('valid_until'),
  status: varchar('status', { length: 50 }).default('draft'),
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).default('0'),
  paymentTerms: integer('payment_terms').default(30),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const salesQuotationLines = pgTable('sales_quotation_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesQuotationId: uuid('sales_quotation_id').notNull().references(() => salesQuotations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  description: text('description'),
  quantity: decimal('quantity', { precision: 15, scale: 2 }).notNull(),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  discount: decimal('discount', { precision: 5, scale: 2 }).default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Sales Invoices
export const salesInvoices = pgTable('sales_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  salesOrderId: uuid('sales_order_id').references(() => salesOrders.id, { onDelete: 'set null' }),
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
  invoiceDate: date('invoice_date').notNull().defaultNow(),
  dueDate: date('due_date'),
  status: varchar('status', { length: 50 }).default('draft'),
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).default('0'),
  paidAmount: decimal('paid_amount', { precision: 15, scale: 2 }).default('0'),
  balanceAmount: decimal('balance_amount', { precision: 15, scale: 2 }).default('0'),
  paymentTerms: integer('payment_terms').default(30),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const salesInvoiceLines = pgTable('sales_invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesInvoiceId: uuid('sales_invoice_id').notNull().references(() => salesInvoices.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  description: text('description'),
  quantity: decimal('quantity', { precision: 15, scale: 2 }).notNull(),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  discount: decimal('discount', { precision: 5, scale: 2 }).default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// MANUFACTURING (Basic)
// ============================================

export const bomHeaders = pgTable('bom_headers', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  bomName: varchar('bom_name', { length: 255 }).notNull(),
  bomVersion: varchar('bom_version', { length: 50 }).default('1.0'),
  quantityProduced: decimal('quantity_produced', { precision: 15, scale: 2 }).default('1'),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const bomLines = pgTable('bom_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  bomHeaderId: uuid('bom_header_id').notNull().references(() => bomHeaders.id, { onDelete: 'cascade' }),
  componentProductId: uuid('component_product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  componentVariantId: uuid('component_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  quantityRequired: decimal('quantity_required', { precision: 15, scale: 2 }).notNull(),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  scrapPercentage: decimal('scrap_percentage', { precision: 5, scale: 2 }).default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// manufacturingOrders moved to manufacturing.ts schema

// ============================================
// AUDIT & ACTIVITY LOGS
// ============================================

export const erpActivityLogs = pgTable('erp_activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  changes: jsonb('changes'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [suppliers.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  contacts: many(supplierContacts),
  purchaseOrders: many(purchaseOrders),
  quotationSubmissions: many(supplierQuotationSubmissions),
}));

export const supplierContactsRelations = relations(supplierContacts, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierContacts.supplierId],
    references: [suppliers.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [customers.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  contacts: many(customerContacts),
  salesOrders: many(salesOrders),
  salesQuotations: many(salesQuotations),
  salesInvoices: many(salesInvoices),
}));

export const customerContactsRelations = relations(customerContacts, ({ one }) => ({
  customer: one(customers, {
    fields: [customerContacts.customerId],
    references: [customers.id],
  }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [purchaseOrders.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  warehouse: one(warehouses, {
    fields: [purchaseOrders.warehouseId],
    references: [warehouses.id],
  }),
  location: one(warehouseLocations, {
    fields: [purchaseOrders.locationId],
    references: [warehouseLocations.id],
  }),
  lines: many(purchaseOrderLines),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderLines.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [purchaseOrderLines.productId],
    references: [products.id],
  }),
  productVariant: one(productVariants, {
    fields: [purchaseOrderLines.productVariantId],
    references: [productVariants.id],
  }),
  uom: one(unitsOfMeasure, {
    fields: [purchaseOrderLines.uomId],
    references: [unitsOfMeasure.id],
  }),
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [salesOrders.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.id],
  }),
  warehouse: one(warehouses, {
    fields: [salesOrders.warehouseId],
    references: [warehouses.id],
  }),
  lines: many(salesOrderLines),
}));

export const vendorInvoicesRelations = relations(vendorInvoices, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [vendorInvoices.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  supplier: one(suppliers, {
    fields: [vendorInvoices.supplierId],
    references: [suppliers.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [vendorInvoices.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  lines: many(vendorInvoiceLines),
}));

export const goodsReceiptsRelations = relations(goodsReceipts, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [goodsReceipts.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [goodsReceipts.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  warehouse: one(warehouses, {
    fields: [goodsReceipts.warehouseId],
    references: [warehouses.id],
  }),
  supplier: one(suppliers, {
    fields: [goodsReceipts.supplierId],
    references: [suppliers.id],
  }),
  lines: many(goodsReceiptLines),
}));

export const salesOrderLinesRelations = relations(salesOrderLines, ({ one }) => ({
  salesOrder: one(salesOrders, {
    fields: [salesOrderLines.salesOrderId],
    references: [salesOrders.id],
  }),
  product: one(products, {
    fields: [salesOrderLines.productId],
    references: [products.id],
  }),
  productVariant: one(productVariants, {
    fields: [salesOrderLines.productVariantId],
    references: [productVariants.id],
  }),
  uom: one(unitsOfMeasure, {
    fields: [salesOrderLines.uomId],
    references: [unitsOfMeasure.id],
  }),
}));

export const salesQuotationsRelations = relations(salesQuotations, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [salesQuotations.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  customer: one(customers, {
    fields: [salesQuotations.customerId],
    references: [customers.id],
  }),
  lines: many(salesQuotationLines),
}));

export const salesQuotationLinesRelations = relations(salesQuotationLines, ({ one }) => ({
  salesQuotation: one(salesQuotations, {
    fields: [salesQuotationLines.salesQuotationId],
    references: [salesQuotations.id],
  }),
  product: one(products, {
    fields: [salesQuotationLines.productId],
    references: [products.id],
  }),
  productVariant: one(productVariants, {
    fields: [salesQuotationLines.productVariantId],
    references: [productVariants.id],
  }),
  uom: one(unitsOfMeasure, {
    fields: [salesQuotationLines.uomId],
    references: [unitsOfMeasure.id],
  }),
}));

export const salesInvoicesRelations = relations(salesInvoices, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [salesInvoices.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  customer: one(customers, {
    fields: [salesInvoices.customerId],
    references: [customers.id],
  }),
  salesOrder: one(salesOrders, {
    fields: [salesInvoices.salesOrderId],
    references: [salesOrders.id],
  }),
  lines: many(salesInvoiceLines),
}));

export const salesInvoiceLinesRelations = relations(salesInvoiceLines, ({ one }) => ({
  salesInvoice: one(salesInvoices, {
    fields: [salesInvoiceLines.salesInvoiceId],
    references: [salesInvoices.id],
  }),
  product: one(products, {
    fields: [salesInvoiceLines.productId],
    references: [products.id],
  }),
  productVariant: one(productVariants, {
    fields: [salesInvoiceLines.productVariantId],
    references: [productVariants.id],
  }),
  uom: one(unitsOfMeasure, {
    fields: [salesInvoiceLines.uomId],
    references: [unitsOfMeasure.id],
  }),
}));

export const vendorInvoiceLinesRelations = relations(vendorInvoiceLines, ({ one }) => ({
  vendorInvoice: one(vendorInvoices, {
    fields: [vendorInvoiceLines.vendorInvoiceId],
    references: [vendorInvoices.id],
  }),
  product: one(products, {
    fields: [vendorInvoiceLines.productId],
    references: [products.id],
  }),
  productVariant: one(productVariants, {
    fields: [vendorInvoiceLines.productVariantId],
    references: [productVariants.id],
  }),
  uom: one(unitsOfMeasure, {
    fields: [vendorInvoiceLines.uomId],
    references: [unitsOfMeasure.id],
  }),
}));

export const goodsReceiptLinesRelations = relations(goodsReceiptLines, ({ one }) => ({
  goodsReceipt: one(goodsReceipts, {
    fields: [goodsReceiptLines.goodsReceiptId],
    references: [goodsReceipts.id],
  }),
  product: one(products, {
    fields: [goodsReceiptLines.productId],
    references: [products.id],
  }),
  productVariant: one(productVariants, {
    fields: [goodsReceiptLines.productVariantId],
    references: [productVariants.id],
  }),
  uom: one(unitsOfMeasure, {
    fields: [goodsReceiptLines.uomId],
    references: [unitsOfMeasure.id],
  }),
}));

// ============================================
// RFQ & QUOTATIONS
// ============================================

export const requestForQuotations = pgTable('request_for_quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  rfqNumber: varchar('rfq_number', { length: 100 }).notNull(),
  rfqDate: date('rfq_date').notNull().defaultNow(),
  deadlineDate: date('deadline_date'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('draft'),
  currencyCode: varchar('currency_code', { length: 3 }).default('INR'),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const rfqLines = pgTable('rfq_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => requestForQuotations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  description: text('description'),
  quantityRequested: decimal('quantity_requested', { precision: 15, scale: 2 }).notNull(),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  targetPrice: decimal('target_price', { precision: 15, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const rfqSuppliers = pgTable('rfq_suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => requestForQuotations.id, { onDelete: 'cascade' }),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  invitedDate: timestamp('invited_date', { withTimezone: true }).defaultNow(),
  responded: boolean('responded').default(false),
  responseDate: timestamp('response_date', { withTimezone: true }),
  notes: text('notes'),
});

export const supplierQuotations = pgTable('supplier_quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  rfqId: uuid('rfq_id').references(() => requestForQuotations.id, { onDelete: 'set null' }),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
  quotationNumber: varchar('quotation_number', { length: 100 }).notNull(),
  quotationDate: date('quotation_date').notNull().defaultNow(),
  validUntil: date('valid_until'),
  status: varchar('status', { length: 50 }).default('draft'),
  currencyCode: varchar('currency_code', { length: 3 }).default('INR'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  shippingCharges: decimal('shipping_charges', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  paymentTerms: integer('payment_terms').default(30),
  deliveryTime: integer('delivery_time'),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const quotationLines = pgTable('quotation_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationId: uuid('quotation_id').notNull().references(() => supplierQuotations.id, { onDelete: 'cascade' }),
  rfqLineId: uuid('rfq_line_id').references(() => rfqLines.id, { onDelete: 'set null' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  description: text('description'),
  quantity: decimal('quantity', { precision: 15, scale: 2 }).notNull(),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0'),
  lineTotal: decimal('line_total', { precision: 15, scale: 2 }).notNull(),
  deliveryTime: integer('delivery_time'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const requestForQuotationsRelations = relations(requestForQuotations, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [requestForQuotations.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  lines: many(rfqLines),
  suppliers: many(rfqSuppliers),
  quotations: many(supplierQuotations),
}));

export const rfqLinesRelations = relations(rfqLines, ({ one }) => ({
  rfq: one(requestForQuotations, {
    fields: [rfqLines.rfqId],
    references: [requestForQuotations.id],
  }),
  product: one(products, {
    fields: [rfqLines.productId],
    references: [products.id],
  }),
}));

export const rfqSuppliersRelations = relations(rfqSuppliers, ({ one }) => ({
  rfq: one(requestForQuotations, {
    fields: [rfqSuppliers.rfqId],
    references: [requestForQuotations.id],
  }),
  supplier: one(suppliers, {
    fields: [rfqSuppliers.supplierId],
    references: [suppliers.id],
  }),
}));

export const productSuppliersRelations = relations(productSuppliers, ({ one }) => ({
  product: one(products, {
    fields: [productSuppliers.productId],
    references: [products.id],
  }),
  supplier: one(suppliers, {
    fields: [productSuppliers.supplierId],
    references: [suppliers.id],
  }),
}));

export const supplierQuotationsRelations = relations(supplierQuotations, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [supplierQuotations.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  rfq: one(requestForQuotations, {
    fields: [supplierQuotations.rfqId],
    references: [requestForQuotations.id],
  }),
  supplier: one(suppliers, {
    fields: [supplierQuotations.supplierId],
    references: [suppliers.id],
  }),
  lines: many(quotationLines),
}));

export const quotationLinesRelations = relations(quotationLines, ({ one }) => ({
  quotation: one(supplierQuotations, {
    fields: [quotationLines.quotationId],
    references: [supplierQuotations.id],
  }),
  rfqLine: one(rfqLines, {
    fields: [quotationLines.rfqLineId],
    references: [rfqLines.id],
  }),
  product: one(products, {
    fields: [quotationLines.productId],
    references: [products.id],
  }),
}));

export const supplierQuotationSubmissionsRelations = relations(supplierQuotationSubmissions, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierQuotationSubmissions.supplierId],
    references: [suppliers.id],
  }),
  rfq: one(requestForQuotations, {
    fields: [supplierQuotationSubmissions.rfqId],
    references: [requestForQuotations.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [supplierQuotationSubmissions.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));

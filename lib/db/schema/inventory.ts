import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, decimal, date, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { erpOrganizations } from './core';

// ============================================
// INVENTORY MANAGEMENT TABLES
// ============================================

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  managerUserId: uuid('manager_user_id'), // References users(id) from mainDb
  isActive: boolean('is_active').default(true),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const warehouseManagers = pgTable('warehouse_managers', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id').notNull().unique().references(() => warehouses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  mobileNumber: varchar('mobile_number', { length: 50 }),
  gender: varchar('gender', { length: 50 }), // 'Male', 'Female', 'Other', 'Prefer not to say'
  otp: varchar('otp', { length: 6 }),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const warehouseLocations: any = pgTable('warehouse_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  locationType: varchar('location_type', { length: 50 }), // 'zone', 'aisle', 'rack', 'shelf', 'bin'
  parentLocationId: uuid('parent_location_id').references(() => warehouseLocations.id, { onDelete: 'set null' }),
  capacity: decimal('capacity', { precision: 15, scale: 2 }),
  currentUtilization: decimal('current_utilization', { precision: 15, scale: 2 }).default('0'),
  address: text('address'),
  managerName: varchar('manager_name', { length: 255 }),
  managerEmail: varchar('manager_email', { length: 255 }),
  managerMobile: varchar('manager_mobile', { length: 50 }),
  managerGender: varchar('manager_gender', { length: 50 }),
  otp: varchar('otp', { length: 6 }),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const productCategories: any = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  description: text('description'),
  parentCategoryId: uuid('parent_category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const productSubCategories: any = pgTable('product_sub_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  productCategoryId: uuid('product_category_id').notNull().references(() => productCategories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  description: text('description'),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const unitsOfMeasure = pgTable('units_of_measure', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).notNull(),
  uomType: varchar('uom_type', { length: 50 }), // 'unit', 'weight', 'volume', 'length', 'area', 'time'
  isBaseUnit: boolean('is_base_unit').default(false),
  conversionFactor: decimal('conversion_factor', { precision: 15, scale: 6 }).default('1.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  productCategoryId: uuid('product_category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  productSubCategoryId: uuid('product_sub_category_id').references(() => productSubCategories.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }).notNull(),
  barcode: varchar('barcode', { length: 100 }),
  description: text('description'),
  productType: varchar('product_type', { length: 50 }).notNull(), // 'storable', 'consumable', 'service'
  trackingType: varchar('tracking_type', { length: 50 }).default('none'), // 'none', 'serial', 'lot'
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  purchaseUomId: uuid('purchase_uom_id').references(() => unitsOfMeasure.id),
  saleUomId: uuid('sale_uom_id').references(() => unitsOfMeasure.id),
  costPrice: decimal('cost_price', { precision: 15, scale: 2 }).default('0'),
  salePrice: decimal('sale_price', { precision: 15, scale: 2 }).default('0'),
  weight: decimal('weight', { precision: 15, scale: 3 }),
  volume: decimal('volume', { precision: 15, scale: 3 }),
  // Measurement attributes
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }), // 'weight_g', 'volume_ml', 'length_m'
  unitWeight: decimal('unit_weight', { precision: 15, scale: 3 }), // weight of one unit in grams
  // Tax identity columns
  hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
  taxCategory: varchar('tax_category', { length: 50 }), // 'taxable', 'exempt', 'nil_rated', 'rcm_applicable'
  defaultGstRate: decimal('default_gst_rate', { precision: 5, scale: 2 }), // 5.00, 12.00, 18.00, 28.00
  defaultPurchaseTaxId: uuid('default_purchase_tax_id'),
  defaultSalesTaxId: uuid('default_sales_tax_id'),
  // Metal-specific attributes for Leo Metals
  metalGrade: varchar('metal_grade', { length: 100 }), // e.g., 'A36', '304', '316L', 'MS', 'SS'
  metalAlloyType: varchar('metal_alloy_type', { length: 100 }), // e.g., 'Steel', 'Aluminum', 'Copper', 'Stainless Steel'
  metalThickness: decimal('metal_thickness', { precision: 15, scale: 4 }), // in millimeters
  metalWidth: decimal('metal_width', { precision: 15, scale: 4 }), // in millimeters or meters
  metalLength: decimal('metal_length', { precision: 15, scale: 4 }), // in millimeters or meters
  metalDiameter: decimal('metal_diameter', { precision: 15, scale: 4 }), // in millimeters (for rods, pipes)
  metalFinish: varchar('metal_finish', { length: 100 }), // e.g., 'Polished', 'Matte', 'Galvanized', 'Painted'
  metalForm: varchar('metal_form', { length: 100 }), // e.g., 'Sheet', 'Plate', 'Rod', 'Tube', 'Pipe', 'Coil', 'Bar'
  weightPerUnit: decimal('weight_per_unit', { precision: 15, scale: 4 }), // weight in kg per unit
  weightCalculationFormula: text('weight_calculation_formula'), // formula for calculating weight
  metalCertification: varchar('metal_certification', { length: 255 }), // e.g., 'ISO 9001', 'CE Mark', 'BIS Certification'
  metalTestCertificate: varchar('metal_test_certificate', { length: 255 }), // mill test certificate number
  metalHeatTreatment: varchar('metal_heat_treatment', { length: 100 }), // e.g., 'Annealed', 'Tempered', 'Hardened'
  metalCoating: varchar('metal_coating', { length: 100 }), // e.g., 'Zinc', 'Chrome', 'Nickel'
  carbonContent: decimal('carbon_content', { precision: 5, scale: 3 }), // percentage of carbon content
  metalDensity: decimal('metal_density', { precision: 15, scale: 6 }), // density in g/cm³ or kg/m³
  metalCountryOfOrigin: varchar('metal_country_of_origin', { length: 100 }), // country where metal was manufactured
  metalManufacturer: varchar('metal_manufacturer', { length: 255 }), // manufacturer/mill name
  isScrapMaterial: boolean('is_scrap_material').default(false), // whether this is scrap/waste material
  metalSurfaceTreatment: varchar('metal_surface_treatment', { length: 100 }), // e.g., 'Polished', 'Brushed', 'Sandblasted'
  imageUrl: text('image_url'),
  isActive: boolean('is_active').default(true),
  reorderPoint: decimal('reorder_point', { precision: 15, scale: 2 }).default('0'),
  reorderQuantity: decimal('reorder_quantity', { precision: 15, scale: 2 }).default('0'),
  leadTimeDays: integer('lead_time_days').default(0),
  notes: text('notes'),
  createdBy: uuid('created_by'), // References users(id) from mainDb
  updatedBy: uuid('updated_by'), // References users(id) from mainDb
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantName: varchar('variant_name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }).notNull(),
  barcode: varchar('barcode', { length: 100 }),
  attributes: jsonb('attributes').default({}),
  costPrice: decimal('cost_price', { precision: 15, scale: 2 }),
  salePrice: decimal('sale_price', { precision: 15, scale: 2 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const stockLevels = pgTable('stock_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => warehouseLocations.id, { onDelete: 'set null' }),
  quantityOnHand: decimal('quantity_on_hand', { precision: 15, scale: 2 }).default('0'),
  quantityReserved: decimal('quantity_reserved', { precision: 15, scale: 2 }).default('0'),
  binPosition: varchar('bin_position', { length: 50 }),
  rackNumber: varchar('rack_number', { length: 50 }),
  lastCountedAt: timestamp('last_counted_at', { withTimezone: true }),
  lastCountedBy: uuid('last_counted_by'), // References users(id) from mainDb
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const serialLotNumbers = pgTable('serial_lot_numbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => warehouseLocations.id, { onDelete: 'set null' }),
  trackingNumber: varchar('tracking_number', { length: 255 }).notNull(),
  trackingType: varchar('tracking_type', { length: 50 }), // 'serial', 'lot'
  quantity: decimal('quantity', { precision: 15, scale: 2 }).default('1'),
  manufactureDate: date('manufacture_date'),
  expiryDate: date('expiry_date'),
  status: varchar('status', { length: 50 }).default('available'), // 'available', 'reserved', 'sold', 'damaged', 'expired'
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  movementType: varchar('movement_type', { length: 50 }).notNull(), // 'receipt', 'delivery', 'internal_transfer', 'adjustment', 'return', 'scrap'
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),
  sourceWarehouseId: uuid('source_warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  sourceLocationId: uuid('source_location_id').references(() => warehouseLocations.id, { onDelete: 'set null' }),
  destinationWarehouseId: uuid('destination_warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  destinationLocationId: uuid('destination_location_id').references(() => warehouseLocations.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).default('draft'), // 'draft', 'confirmed', 'processing', 'completed', 'cancelled'
  scheduledDate: timestamp('scheduled_date', { withTimezone: true }),
  completedDate: timestamp('completed_date', { withTimezone: true }),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(), // References users(id) from mainDb
  updatedBy: uuid('updated_by'), // References users(id) from mainDb
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const stockMovementLines = pgTable('stock_movement_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  stockMovementId: uuid('stock_movement_id').notNull().references(() => stockMovements.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  serialLotId: uuid('serial_lot_id').references(() => serialLotNumbers.id, { onDelete: 'set null' }),
  quantityOrdered: decimal('quantity_ordered', { precision: 15, scale: 2 }).notNull(),
  quantityProcessed: decimal('quantity_processed', { precision: 15, scale: 2 }).default('0'),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id),
  unitCost: decimal('unit_cost', { precision: 15, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const stockAdjustments = pgTable('stock_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  adjustmentType: varchar('adjustment_type', { length: 50 }).notNull(), // 'cycle_count', 'write_off', 'damage', 'found', 'correction'
  referenceNumber: varchar('reference_number', { length: 100 }),
  adjustmentDate: timestamp('adjustment_date', { withTimezone: true }).defaultNow(),
  status: varchar('status', { length: 50 }).default('draft'), // 'draft', 'confirmed', 'cancelled'
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(), // References users(id) from mainDb
  approvedBy: uuid('approved_by'), // References users(id) from mainDb
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const stockAdjustmentLines = pgTable('stock_adjustment_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  stockAdjustmentId: uuid('stock_adjustment_id').notNull().references(() => stockAdjustments.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  warehouseLocationId: uuid('warehouse_location_id').references(() => warehouseLocations.id, { onDelete: 'set null' }),
  countedQuantity: decimal('counted_quantity', { precision: 15, scale: 2 }).notNull(),
  systemQuantity: decimal('system_quantity', { precision: 15, scale: 2 }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const stockAlerts = pgTable('stock_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }),
  alertType: varchar('alert_type', { length: 50 }).notNull(), // 'low_stock', 'out_of_stock', 'overstock', 'expiry_warning'
  alertLevel: varchar('alert_level', { length: 50 }).default('warning'), // 'info', 'warning', 'critical'
  message: text('message').notNull(),
  currentQuantity: decimal('current_quantity', { precision: 15, scale: 2 }),
  thresholdQuantity: decimal('threshold_quantity', { precision: 15, scale: 2 }),
  isResolved: boolean('is_resolved').default(false),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by'), // References users(id) from mainDb
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const salesHistory = pgTable('sales_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  quantitySold: decimal('quantity_sold', { precision: 15, scale: 2 }).notNull().default('0'),
  revenue: decimal('revenue', { precision: 15, scale: 2 }).default('0'),
  costOfGoodsSold: decimal('cost_of_goods_sold', { precision: 15, scale: 2 }).default('0'),
  numberOfOrders: integer('number_of_orders').default(0),
  averageOrderQuantity: decimal('average_order_quantity', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [warehouses.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  locations: many(warehouseLocations),
  stockLevels: many(stockLevels),
  manager: one(warehouseManagers, {
    fields: [warehouses.id],
    references: [warehouseManagers.warehouseId],
  }),
}));

export const warehouseManagersRelations = relations(warehouseManagers, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [warehouseManagers.warehouseId],
    references: [warehouses.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [products.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  category: one(productCategories, {
    fields: [products.productCategoryId],
    references: [productCategories.id],
  }),
  subCategory: one(productSubCategories, {
    fields: [products.productSubCategoryId],
    references: [productSubCategories.id],
  }),
  variants: many(productVariants),
  stockLevels: many(stockLevels),
}));

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  product: one(products, {
    fields: [stockLevels.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockLevels.warehouseId],
    references: [warehouses.id],
  }),
  location: one(warehouseLocations, {
    fields: [stockLevels.locationId],
    references: [warehouseLocations.id],
  }),
  productVariant: one(productVariants, {
    fields: [stockLevels.productVariantId],
    references: [productVariants.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [stockMovements.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  sourceWarehouse: one(warehouses, {
    fields: [stockMovements.sourceWarehouseId],
    references: [warehouses.id],
  }),
  destinationWarehouse: one(warehouses, {
    fields: [stockMovements.destinationWarehouseId],
    references: [warehouses.id],
  }),
  lines: many(stockMovementLines),
}));

export const stockMovementLinesRelations = relations(stockMovementLines, ({ one }) => ({
  movement: one(stockMovements, {
    fields: [stockMovementLines.stockMovementId],
    references: [stockMovements.id],
  }),
  product: one(products, {
    fields: [stockMovementLines.productId],
    references: [products.id],
  }),
  productVariant: one(productVariants, {
    fields: [stockMovementLines.productVariantId],
    references: [productVariants.id],
  }),
}));

export const stockAdjustmentsRelations = relations(stockAdjustments, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [stockAdjustments.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockAdjustments.warehouseId],
    references: [warehouses.id],
  }),
  lines: many(stockAdjustmentLines),
}));

export const stockAdjustmentLinesRelations = relations(stockAdjustmentLines, ({ one }) => ({
  adjustment: one(stockAdjustments, {
    fields: [stockAdjustmentLines.stockAdjustmentId],
    references: [stockAdjustments.id],
  }),
  product: one(products, {
    fields: [stockAdjustmentLines.productId],
    references: [products.id],
  }),
  productVariant: one(productVariants, {
    fields: [stockAdjustmentLines.productVariantId],
    references: [productVariants.id],
  }),
}));

export const warehouseLocationsRelations = relations(warehouseLocations, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [warehouseLocations.warehouseId],
    references: [warehouses.id],
  }),
  parentLocation: one(warehouseLocations, {
    fields: [warehouseLocations.parentLocationId],
    references: [warehouseLocations.id],
  }),
  childLocations: many(warehouseLocations),
}));

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [productCategories.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  parentCategory: one(productCategories, {
    fields: [productCategories.parentCategoryId],
    references: [productCategories.id],
  }),
  childCategories: many(productCategories),
  products: many(products),
}));

export const stockAlertsRelations = relations(stockAlerts, ({ one }) => ({
  organization: one(erpOrganizations, {
    fields: [stockAlerts.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  product: one(products, {
    fields: [stockAlerts.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockAlerts.warehouseId],
    references: [warehouses.id],
  }),
}));

export const salesHistoryRelations = relations(salesHistory, ({ one }) => ({
  organization: one(erpOrganizations, {
    fields: [salesHistory.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  product: one(products, {
    fields: [salesHistory.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [salesHistory.warehouseId],
    references: [warehouses.id],
  }),
}));

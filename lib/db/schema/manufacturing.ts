import { pgTable, uuid, varchar, text, timestamp, boolean, decimal, integer, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { erpOrganizations } from './core';
import { products, warehouses } from './inventory';

// ============================================
// MANUFACTURING MANAGEMENT TABLES
// ============================================

// Bill of Materials (BOM)
export const boms = pgTable('boms', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  bomNumber: varchar('bom_number', { length: 100 }).notNull(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 50 }).default('1.0'),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  scrapPercentage: decimal('scrap_percentage', { precision: 5, scale: 2 }).default('0'),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).default('active'), // 'active', 'inactive', 'archived'
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// BOM Components (lines/items in a BOM)
export const bomComponents = pgTable('bom_components', {
  id: uuid('id').primaryKey().defaultRandom(),
  bomId: uuid('bom_id').notNull().references(() => boms.id, { onDelete: 'cascade' }),
  componentProductId: uuid('component_product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  scrapPercentage: decimal('scrap_percentage', { precision: 5, scale: 2 }).default('0'),
  componentType: varchar('component_type', { length: 50 }).default('raw_material'), // 'raw_material', 'semi_finished', 'consumable'
  sequence: integer('sequence').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Work Centers (Machines, Assembly Lines, etc.)
export const workCenters = pgTable('work_centers', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'machine', 'assembly_line', 'testing', 'packaging'
  capacityPerDay: decimal('capacity_per_day', { precision: 15, scale: 2 }).notNull(),
  capacityUom: varchar('capacity_uom', { length: 50 }).notNull(), // 'hours', 'units', etc.
  costPerHour: decimal('cost_per_hour', { precision: 15, scale: 2 }).notNull(),
  efficiency: decimal('efficiency', { precision: 5, scale: 2 }).default('100'), // Percentage
  currentUtilization: decimal('current_utilization', { precision: 5, scale: 2 }).default('0'), // Percentage
  status: varchar('status', { length: 50 }).default('active'), // 'active', 'idle', 'maintenance', 'breakdown'
  location: varchar('location', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Routing (Operation Sequences)
export const routings = pgTable('routings', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  routingCode: varchar('routing_code', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).default('active'), // 'active', 'archived'
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Routing Operations
export const routingOperations = pgTable('routing_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  routingId: uuid('routing_id').notNull().references(() => routings.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  operationName: varchar('operation_name', { length: 255 }).notNull(),
  workCenterId: uuid('work_center_id').notNull().references(() => workCenters.id, { onDelete: 'cascade' }),
  setupTime: decimal('setup_time', { precision: 10, scale: 2 }).default('0'), // in minutes
  runTimePerUnit: decimal('run_time_per_unit', { precision: 10, scale: 2 }).default('0'), // in minutes
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Manufacturing Orders
export const manufacturingOrders = pgTable('manufacturing_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  moNumber: varchar('mo_number', { length: 100 }).notNull(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  bomId: uuid('bom_id').references(() => boms.id, { onDelete: 'set null' }),
  routingId: uuid('routing_id').references(() => routings.id, { onDelete: 'set null' }),
  plannedQuantity: decimal('planned_quantity', { precision: 15, scale: 2 }).notNull(),
  producedQuantity: decimal('produced_quantity', { precision: 15, scale: 2 }).default('0'),
  status: varchar('status', { length: 50 }).default('draft'), // 'draft', 'confirmed', 'in_progress', 'done', 'cancelled'
  priority: varchar('priority', { length: 50 }).default('medium'), // 'low', 'medium', 'high', 'urgent'
  scheduledStart: date('scheduled_start').notNull(),
  scheduledEnd: date('scheduled_end').notNull(),
  actualStart: timestamp('actual_start', { withTimezone: true }),
  actualEnd: timestamp('actual_end', { withTimezone: true }),
  sourceWarehouseId: uuid('source_warehouse_id').references(() => warehouses.id),
  destinationWarehouseId: uuid('destination_warehouse_id').references(() => warehouses.id),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Manufacturing Order Operations (Work Order Lines)
export const moOperations = pgTable('mo_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  moId: uuid('mo_id').notNull().references(() => manufacturingOrders.id, { onDelete: 'cascade' }),
  operationName: varchar('operation_name', { length: 255 }).notNull(),
  workCenterId: uuid('work_center_id').notNull().references(() => workCenters.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  setupTime: decimal('setup_time', { precision: 10, scale: 2 }).default('0'),
  runTime: decimal('run_time', { precision: 10, scale: 2 }).default('0'),
  actualTime: decimal('actual_time', { precision: 10, scale: 2 }),
  status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'in_progress', 'done', 'cancelled'
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Material Consumption
export const materialConsumption = pgTable('material_consumption', {
  id: uuid('id').primaryKey().defaultRandom(),
  moId: uuid('mo_id').notNull().references(() => manufacturingOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  requiredQuantity: decimal('required_quantity', { precision: 15, scale: 4 }).notNull(),
  consumedQuantity: decimal('consumed_quantity', { precision: 15, scale: 4 }).default('0'),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Production Output
export const productionOutput = pgTable('production_output', {
  id: uuid('id').primaryKey().defaultRandom(),
  moId: uuid('mo_id').notNull().references(() => manufacturingOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: decimal('quantity', { precision: 15, scale: 2 }).notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  outputDate: date('output_date').notNull(),
  batchNumber: varchar('batch_number', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Quality Control
export const qualityChecks = pgTable('quality_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  qcNumber: varchar('qc_number', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'incoming', 'in_process', 'finished_goods'
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  batchNumber: varchar('batch_number', { length: 100 }),
  sourceReference: varchar('source_reference', { length: 100 }), // PO Number or MO Number
  quantityChecked: decimal('quantity_checked', { precision: 15, scale: 2 }).notNull(),
  quantityPassed: decimal('quantity_passed', { precision: 15, scale: 2 }).default('0'),
  quantityFailed: decimal('quantity_failed', { precision: 15, scale: 2 }).default('0'),
  quantityRework: decimal('quantity_rework', { precision: 15, scale: 2 }).default('0'),
  status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'in_progress', 'passed', 'failed', 'partial'
  inspector: varchar('inspector', { length: 255 }),
  checkDate: date('check_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Quality Check Points
export const qcCheckpoints = pgTable('qc_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  qcId: uuid('qc_id').notNull().references(() => qualityChecks.id, { onDelete: 'cascade' }),
  checkpointName: varchar('checkpoint_name', { length: 255 }).notNull(),
  specification: text('specification'),
  measuredValue: text('measured_value'),
  result: varchar('result', { length: 50 }), // 'pass', 'fail', 'pending'
  remarks: text('remarks'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Quality Defects
export const qcDefects = pgTable('qc_defects', {
  id: uuid('id').primaryKey().defaultRandom(),
  qcId: uuid('qc_id').notNull().references(() => qualityChecks.id, { onDelete: 'cascade' }),
  defectType: varchar('defect_type', { length: 100 }).notNull(),
  description: text('description'),
  quantity: decimal('quantity', { precision: 15, scale: 2 }).notNull(),
  severity: varchar('severity', { length: 50 }),
  action: varchar('action', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Work Center Downtime Log
export const downtimeLog = pgTable('downtime_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  workCenterId: uuid('work_center_id').notNull().references(() => workCenters.id, { onDelete: 'cascade' }),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  reason: text('reason').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'maintenance', 'breakdown', 'changeover'
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const bomsRelations = relations(boms, ({ one, many }) => ({
  erpOrganization: one(erpOrganizations, {
    fields: [boms.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  product: one(products, {
    fields: [boms.productId],
    references: [products.id],
  }),
  components: many(bomComponents),
}));

export const bomComponentsRelations = relations(bomComponents, ({ one }) => ({
  bom: one(boms, {
    fields: [bomComponents.bomId],
    references: [boms.id],
  }),
  component: one(products, {
    fields: [bomComponents.componentProductId],
    references: [products.id],
  }),
}));

export const workCentersRelations = relations(workCenters, ({ one, many }) => ({
  erpOrganization: one(erpOrganizations, {
    fields: [workCenters.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  operations: many(routingOperations),
  downtime: many(downtimeLog),
}));

export const routingsRelations = relations(routings, ({ one, many }) => ({
  erpOrganization: one(erpOrganizations, {
    fields: [routings.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  product: one(products, {
    fields: [routings.productId],
    references: [products.id],
  }),
  operations: many(routingOperations),
}));

export const routingOperationsRelations = relations(routingOperations, ({ one }) => ({
  routing: one(routings, {
    fields: [routingOperations.routingId],
    references: [routings.id],
  }),
  workCenter: one(workCenters, {
    fields: [routingOperations.workCenterId],
    references: [workCenters.id],
  }),
}));

export const manufacturingOrdersRelations = relations(manufacturingOrders, ({ one, many }) => ({
  erpOrganization: one(erpOrganizations, {
    fields: [manufacturingOrders.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  product: one(products, {
    fields: [manufacturingOrders.productId],
    references: [products.id],
  }),
  bom: one(boms, {
    fields: [manufacturingOrders.bomId],
    references: [boms.id],
  }),
  routing: one(routings, {
    fields: [manufacturingOrders.routingId],
    references: [routings.id],
  }),
  operations: many(moOperations),
  materialConsumption: many(materialConsumption),
  productionOutput: many(productionOutput),
}));

export const qualityChecksRelations = relations(qualityChecks, ({ one, many }) => ({
  erpOrganization: one(erpOrganizations, {
    fields: [qualityChecks.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  product: one(products, {
    fields: [qualityChecks.productId],
    references: [products.id],
  }),
  checkpoints: many(qcCheckpoints),
  defects: many(qcDefects),
}));

import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// CORE ERP TABLES
// ============================================

export const erpOrganizations = pgTable('erp_organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  mainOrgId: uuid('main_org_id').notNull().unique(), // References organizations(id) from mainDb
  erpEnabled: boolean('erp_enabled').default(true),
  settings: jsonb('settings').default({}),
  fiscalYearStart: integer('fiscal_year_start').default(1),
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const erpDepartments = pgTable('erp_departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  mainDepartmentId: uuid('main_department_id').notNull().unique(), // References departments(id) from mainDb
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  canManageInventory: boolean('can_manage_inventory').default(false),
  canManagePurchases: boolean('can_manage_purchases').default(false),
  canManageSales: boolean('can_manage_sales').default(false),
  canManageManufacturing: boolean('can_manage_manufacturing').default(false),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const erpUserAccess = pgTable('erp_user_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  mainUserId: uuid('main_user_id').notNull(), // References users(id) from mainDb
  erpOrganizationId: uuid('erp_organization_id').notNull().references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  erpDepartmentId: uuid('erp_department_id').references(() => erpDepartments.id, { onDelete: 'set null' }),
  role: varchar('role', { length: 50 }).notNull(), // 'admin', 'warehouse_manager', 'location_manager', 'user', 'viewer'
  isActive: boolean('is_active').default(true),
  permissions: jsonb('permissions').default({}),
  warehouseId: uuid('warehouse_id'), // For warehouse managers
  warehouseLocationId: uuid('warehouse_location_id'), // For location managers
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const erpOrganizationsRelations = relations(erpOrganizations, ({ many }) => ({
  departments: many(erpDepartments),
  userAccess: many(erpUserAccess),
}));

export const erpDepartmentsRelations = relations(erpDepartments, ({ one, many }) => ({
  organization: one(erpOrganizations, {
    fields: [erpDepartments.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  userAccess: many(erpUserAccess),
}));

export const erpUserAccessRelations = relations(erpUserAccess, ({ one }) => ({
  organization: one(erpOrganizations, {
    fields: [erpUserAccess.erpOrganizationId],
    references: [erpOrganizations.id],
  }),
  department: one(erpDepartments, {
    fields: [erpUserAccess.erpDepartmentId],
    references: [erpDepartments.id],
  }),
}));

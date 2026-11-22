import { boolean, check, date, foreignKey, index, jsonb, numeric, pgTable, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const user = pgTable('user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false), image: text('image'),
  platformOwner: boolean('platform_owner').notNull().default(false),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})
export const session = pgTable('session', {
  id: text('id').primaryKey(), expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(), createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(), ipAddress: text('ipAddress'), userAgent: text('userAgent'), userId: text('userId').notNull(),
})
export const account = pgTable('account', {
  id: text('id').primaryKey(), accountId: text('accountId').notNull(), providerId: text('providerId').notNull(), userId: text('userId').notNull(),
  accessToken: text('accessToken'), refreshToken: text('refreshToken'), idToken: text('idToken'), accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }), refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }), scope: text('scope'), password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})
export const verification = pgTable('verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(), expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(), updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
})

/* ------------------------------------------------------------------ */
/* Multi-business workspace                                           */
/* ------------------------------------------------------------------ */

export const businesses = pgTable('businesses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  registrationNumber: text('registration_number'),
  taxIdentificationNumber: text('tax_identification_number'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  country: text('country').notNull().default('Uganda'),
  currency: text('currency').notNull().default('UGX'),
  timezone: text('timezone').notNull().default('Africa/Kampala'),
  logoUrl: text('logo_url'),
  website: text('website'),
  receiptPrefix: text('receipt_prefix').notNull().default('RCP'),
  invoicePrefix: text('invoice_prefix').notNull().default('INV'),
  footerText: text('footer_text'),
  paymentInstructions: text('payment_instructions'),
  taxDisplaySettings: jsonb('tax_display_settings').notNull().default('{}'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('businesses_status_valid', sql`${table.status} IN ('active','suspended','closed')`),
  index('businesses_status_idx').on(table.status),
])

export const businessRoles = ['owner', 'administrator', 'finance_manager', 'accountant', 'sales_officer', 'cashier', 'viewer'] as const
export type BusinessRole = (typeof businessRoles)[number]

export const businessMemberships = pgTable('business_memberships', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('viewer'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: text('deleted_by'),
}, (table) => [
  check('memberships_role_valid', sql`${table.role} IN ('owner','administrator','finance_manager','accountant','sales_officer','cashier','viewer')`),
  check('memberships_status_valid', sql`${table.status} IN ('active','suspended','removed')`),
  unique('memberships_business_user_uq').on(table.businessId, table.userId),
  index('memberships_user_idx').on(table.userId),
  index('memberships_business_idx').on(table.businessId),
  index('memberships_deleted_at_idx').on(table.deletedAt),
])

/* ------------------------------------------------------------------ */
/* Customers                                                          */
/* ------------------------------------------------------------------ */

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  taxId: text('tax_id'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('customers_status_valid', sql`${table.status} IN ('active','archived')`),
  foreignKey({
    columns: [table.businessId, table.userId],
    foreignColumns: [businessMemberships.businessId, businessMemberships.userId],
    name: 'customers_business_user_fk',
  }).onDelete('restrict'),
  index('customers_business_idx').on(table.businessId),
  index('customers_user_idx').on(table.userId),
])

/* ------------------------------------------------------------------ */
/* Catalogue items                                                    */
/* ------------------------------------------------------------------ */

export const catalogueItems = pgTable('catalogue_items', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('catalogue_status_valid', sql`${table.status} IN ('active','inactive')`),
  check('catalogue_unit_price_nonnegative', sql`${table.unitPrice} >= 0`),
  foreignKey({
    columns: [table.businessId, table.userId],
    foreignColumns: [businessMemberships.businessId, businessMemberships.userId],
    name: 'catalogue_items_business_user_fk',
  }).onDelete('restrict'),
  index('catalogue_items_business_idx').on(table.businessId),
  index('catalogue_items_user_idx').on(table.userId),
])

/* ------------------------------------------------------------------ */
/* Invoices                                                           */
/* ------------------------------------------------------------------ */

export const invoiceStatuses = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'] as const
export type InvoiceStatus = (typeof invoiceStatuses)[number]

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  userId: text('user_id').notNull(),
  customerId: text('customer_id').notNull(),
  number: text('number').notNull(),
  status: text('status').notNull().default('draft'),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  currency: text('currency').notNull().default('UGX'),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 18, scale: 2 }).notNull().default('0'),
  amountPaid: numeric('amount_paid', { precision: 18, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('invoices_status_valid', sql`${table.status} IN ('draft','issued','partially_paid','paid','overdue','cancelled')`),
  check('invoices_total_nonnegative', sql`${table.total} >= 0`),
  check('invoices_amount_paid_nonnegative', sql`${table.amountPaid} >= 0`),
  foreignKey({
    columns: [table.businessId, table.customerId],
    foreignColumns: [customers.businessId, customers.id],
    name: 'invoices_customer_business_fk',
  }),
  foreignKey({
    columns: [table.businessId, table.userId],
    foreignColumns: [businessMemberships.businessId, businessMemberships.userId],
    name: 'invoices_business_user_fk',
  }).onDelete('restrict'),
  unique('invoices_number_business_uq').on(table.businessId, table.number),
  index('invoices_business_idx').on(table.businessId),
  index('invoices_customer_idx').on(table.customerId),
  index('invoices_status_idx').on(table.status),
])

/* ------------------------------------------------------------------ */
/* Invoice items                                                      */
/* ------------------------------------------------------------------ */

export const invoiceItems = pgTable('invoice_items', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  invoiceId: text('invoice_id').notNull(),
  catalogueItemId: text('catalogue_item_id'),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
  lineTotal: numeric('line_total', { precision: 18, scale: 2 }).notNull(),
}, (table) => [
  check('invoice_items_quantity_positive', sql`${table.quantity} > 0`),
  check('invoice_items_unit_price_nonnegative', sql`${table.unitPrice} >= 0`),
  check('invoice_items_line_total_nonnegative', sql`${table.lineTotal} >= 0`),
  foreignKey({
    columns: [table.businessId, table.invoiceId],
    foreignColumns: [invoices.businessId, invoices.id],
    name: 'invoice_items_invoice_business_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.businessId, table.catalogueItemId],
    foreignColumns: [catalogueItems.businessId, catalogueItems.id],
    name: 'invoice_items_catalogue_business_fk',
  }).onDelete('set null'),
  index('invoice_items_invoice_idx').on(table.invoiceId),
  index('invoice_items_business_idx').on(table.businessId),
])

/* ------------------------------------------------------------------ */
/* Payments                                                           */
/* ------------------------------------------------------------------ */

export const paymentMethods = ['cash', 'bank_transfer', 'mobile_money', 'card', 'cheque', 'other'] as const
export type PaymentMethod = (typeof paymentMethods)[number]

export const paymentStatuses = ['confirmed', 'pending', 'failed', 'reversed'] as const
export type PaymentStatus = (typeof paymentStatuses)[number]

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  userId: text('user_id').notNull(),
  customerId: text('customer_id').notNull(),
  reference: text('reference'),
  idempotencyKey: text('idempotency_key'),
  method: text('method').notNull(),
  paidAt: date('paid_at').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('UGX'),
  notes: text('notes'),
  status: text('status').notNull().default('confirmed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('payments_method_valid', sql`${table.method} IN ('cash','bank_transfer','mobile_money','card','cheque','other')`),
  check('payments_status_valid', sql`${table.status} IN ('confirmed','pending','failed','reversed')`),
  check('payments_amount_positive', sql`${table.amount} > 0`),
  foreignKey({
    columns: [table.businessId, table.customerId],
    foreignColumns: [customers.businessId, customers.id],
    name: 'payments_customer_business_fk',
  }),
  foreignKey({
    columns: [table.businessId, table.userId],
    foreignColumns: [businessMemberships.businessId, businessMemberships.userId],
    name: 'payments_business_user_fk',
  }).onDelete('restrict'),
  uniqueIndex('payments_reference_business_uq').on(table.businessId, table.reference).where(sql`${table.reference} IS NOT NULL`),
  uniqueIndex('payments_idempotency_key_business_uq').on(table.businessId, table.idempotencyKey).where(sql`${table.idempotencyKey} IS NOT NULL`),
  index('payments_business_idx').on(table.businessId),
  index('payments_customer_idx').on(table.customerId),
  index('payments_idempotency_idx').on(table.idempotencyKey),
  index('payments_paid_at_idx').on(table.userId, table.paidAt),
])

/* ------------------------------------------------------------------ */
/* Payment allocations                                                */
/* ------------------------------------------------------------------ */

export const paymentAllocations = pgTable('payment_allocations', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  paymentId: text('payment_id').notNull(),
  invoiceId: text('invoice_id').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('payment_allocations_amount_positive', sql`${table.amount} > 0`),
  foreignKey({
    columns: [table.businessId, table.paymentId],
    foreignColumns: [payments.businessId, payments.id],
    name: 'payment_allocations_payment_business_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.businessId, table.invoiceId],
    foreignColumns: [invoices.businessId, invoices.id],
    name: 'payment_allocations_invoice_business_fk',
  }),
  index('payment_allocations_payment_idx').on(table.paymentId),
  index('payment_allocations_invoice_idx').on(table.invoiceId),
  index('payment_allocations_business_idx').on(table.businessId),
])

/* ------------------------------------------------------------------ */
/* Receipts                                                           */
/* ------------------------------------------------------------------ */

export const receiptStatuses = ['issued', 'voided'] as const
export type ReceiptStatus = (typeof receiptStatuses)[number]

export const receipts = pgTable('receipts', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  userId: text('user_id').notNull(),
  paymentId: text('payment_id').notNull(),
  number: text('number').notNull(),
  status: text('status').notNull().default('issued'),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: text('voided_by'),
  verificationToken: text('verification_token').unique(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('receipts_status_valid', sql`${table.status} IN ('issued','voided')`),
  foreignKey({
    columns: [table.businessId, table.paymentId],
    foreignColumns: [payments.businessId, payments.id],
    name: 'receipts_payment_business_fk',
  }),
  foreignKey({
    columns: [table.businessId, table.userId],
    foreignColumns: [businessMemberships.businessId, businessMemberships.userId],
    name: 'receipts_business_user_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.voidedBy],
    foreignColumns: [user.id],
    name: 'receipts_voided_by_fk',
  }).onDelete('set null'),
  unique('receipts_number_business_uq').on(table.businessId, table.number),
  index('receipts_business_idx').on(table.businessId),
  index('receipts_payment_idx').on(table.paymentId),
  index('receipts_status_idx').on(table.status),
])

/* ------------------------------------------------------------------ */
/* Refunds / reversals                                                */
/* ------------------------------------------------------------------ */

export const refundStatuses = ['pending', 'approved', 'completed', 'rejected'] as const
export type RefundStatus = (typeof refundStatuses)[number]

export const refunds = pgTable('refunds', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  paymentId: text('payment_id').notNull(),
  idempotencyKey: text('idempotency_key'),
  requestedBy: text('requested_by').notNull(),
  approvedBy: text('approved_by'),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  reason: text('reason'),
  method: text('method'),
  reference: text('reference'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => [
  check('refunds_status_valid', sql`${table.status} IN ('pending','approved','completed','rejected')`),
  check('refunds_amount_positive', sql`${table.amount} > 0`),
  foreignKey({
    columns: [table.businessId, table.paymentId],
    foreignColumns: [payments.businessId, payments.id],
    name: 'refunds_payment_business_fk',
  }),
  foreignKey({
    columns: [table.businessId, table.requestedBy],
    foreignColumns: [businessMemberships.businessId, businessMemberships.userId],
    name: 'refunds_requested_by_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.approvedBy],
    foreignColumns: [user.id],
    name: 'refunds_approved_by_fk',
  }).onDelete('set null'),
  index('refunds_payment_idx').on(table.paymentId),
  index('refunds_business_idx').on(table.businessId),
  index('refunds_status_idx').on(table.status),
  uniqueIndex('refunds_idempotency_key_business_uq').on(table.businessId, table.idempotencyKey).where(sql`${table.idempotencyKey} IS NOT NULL`),
])

/* ------------------------------------------------------------------ */
/* Expenses                                                           */
/* ------------------------------------------------------------------ */

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  userId: text('user_id').notNull(),
  category: text('category').notNull(),
  payee: text('payee').notNull(),
  description: text('description'),
  method: text('method').notNull(),
  paidAt: date('paid_at').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('expenses_amount_positive', sql`${table.amount} > 0`),
  foreignKey({
    columns: [table.businessId, table.userId],
    foreignColumns: [businessMemberships.businessId, businessMemberships.userId],
    name: 'expenses_business_user_fk',
  }).onDelete('restrict'),
  index('expenses_business_idx').on(table.businessId),
  index('expenses_user_idx').on(table.userId),
  index('expenses_paid_at_idx').on(table.userId, table.paidAt),
])

/* ------------------------------------------------------------------ */
/* Document number sequences                                          */
/* ------------------------------------------------------------------ */

export const documentSequences = pgTable('document_sequences', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  documentType: text('document_type').notNull(),
  lastNumber: numeric('last_number', { precision: 18, scale: 0 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('document_sequences_type_valid', sql`${table.documentType} IN ('invoice','receipt','purchase_order')`),
  unique('document_sequences_business_type_uq').on(table.businessId, table.documentType),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'document_sequences_business_fk',
  }).onDelete('cascade'),
  index('document_sequences_business_idx').on(table.businessId),
])

/* ------------------------------------------------------------------ */
/* Audit logs                                                         */
/* ------------------------------------------------------------------ */

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  details: jsonb('details').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.businessId, table.userId],
    foreignColumns: [businessMemberships.businessId, businessMemberships.userId],
    name: 'audit_logs_business_user_fk',
  }).onDelete('restrict'),
  index('audit_logs_business_idx').on(table.businessId),
  index('audit_logs_user_idx').on(table.userId),
  index('audit_logs_created_at_idx').on(table.createdAt),
])

/* ------------------------------------------------------------------ */
/* Suppliers                                                          */
/* ------------------------------------------------------------------ */

export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  registrationNumber: text('registration_number'),
  taxIdentificationNumber: text('tax_identification_number'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  country: text('country').notNull().default('Uganda'),
  category: text('category'),
  creditLimit: numeric('credit_limit', { precision: 18, scale: 2 }).notNull().default('0'),
  creditTermsDays: numeric('credit_terms_days', { precision: 4, scale: 0 }).notNull().default('0'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('suppliers_status_valid', sql`${table.status} IN ('active','inactive','suspended')`),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'suppliers_business_fk',
  }).onDelete('cascade'),
  index('suppliers_business_idx').on(table.businessId),
  index('suppliers_status_idx').on(table.status),
  index('suppliers_category_idx').on(table.category),
])

/* ------------------------------------------------------------------ */
/* Warehouses                                                         */
/* ------------------------------------------------------------------ */

export const warehouses = pgTable('warehouses', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  address: text('address'),
  city: text('city'),
  country: text('country').notNull().default('Uganda'),
  isDefault: boolean('is_default').notNull().default(false),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('warehouses_status_valid', sql`${table.status} IN ('active','inactive')`),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'warehouses_business_fk',
  }).onDelete('cascade'),
  unique('warehouses_code_business_uq').on(table.businessId, table.code),
  index('warehouses_business_idx').on(table.businessId),
  index('warehouses_status_idx').on(table.status),
])

/* ------------------------------------------------------------------ */
/* Items (Product Catalogue with SKU, Barcode, UOM)                  */
/* ------------------------------------------------------------------ */

export const items = pgTable('items', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  sku: text('sku').notNull(),
  barcode: text('barcode'),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  unitOfMeasure: text('unit_of_measure').notNull().default('unit'),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull().default('0'),
  costPrice: numeric('cost_price', { precision: 18, scale: 2 }).notNull().default('0'),
  taxRateId: text('tax_rate_id'),
  reorderLevel: numeric('reorder_level', { precision: 18, scale: 3 }).notNull().default('0'),
  reorderQuantity: numeric('reorder_quantity', { precision: 18, scale: 3 }).notNull().default('0'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('items_status_valid', sql`${table.status} IN ('active','inactive','discontinued')`),
  check('items_unit_of_measure_valid', sql`${table.unitOfMeasure} IN ('unit','kg','g','lb','oz','ml','l','m','cm','mm','pair','dozen','box','case','pallet')`),
  unique('items_sku_business_uq').on(table.businessId, table.sku),
  unique('items_barcode_business_uq').on(table.businessId, table.barcode),
  foreignKey({
    columns: [table.taxRateId],
    foreignColumns: [taxRates.id],
    name: 'items_tax_rate_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'items_business_fk',
  }).onDelete('cascade'),
  index('items_business_idx').on(table.businessId),
  index('items_sku_idx').on(table.sku),
  index('items_barcode_idx').on(table.barcode),
  index('items_category_idx').on(table.category),
  index('items_status_idx').on(table.status),
])

/* ------------------------------------------------------------------ */
/* Tax Rates                                                          */
/* ------------------------------------------------------------------ */

export const taxRates = pgTable('taxRates', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  name: text('name').notNull(),
  rate: numeric('rate', { precision: 7, scale: 4 }).notNull(),
  type: text('type').notNull().default('vat'),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('tax_rates_rate_positive', sql`${table.rate} >= 0`),
  check('tax_rates_type_valid', sql`${table.type} IN ('vat','withholding','excise','other')`),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'tax_rates_business_fk',
  }).onDelete('cascade'),
  index('tax_rates_business_idx').on(table.businessId),
  index('tax_rates_default_idx').on(table.businessId, table.isDefault),
])

/* ------------------------------------------------------------------ */
/* Stock Movements (Auditable Ledger)                                */
/* ------------------------------------------------------------------ */

export const stockMovements = pgTable('stockMovements', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  itemId: text('item_id').notNull(),
  warehouseId: text('warehouse_id').notNull(),
  movementType: text('movement_type').notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 2 }),
  referenceType: text('reference_type').notNull(),
  referenceId: text('reference_id'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('stock_movements_type_valid', sql`${table.movementType} IN ('in','out','adjustment')`),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'stock_movements_item_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouses.id],
    name: 'stock_movements_warehouse_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'stock_movements_created_by_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'stock_movements_business_fk',
  }).onDelete('cascade'),
  index('stock_movements_business_idx').on(table.businessId),
  index('stock_movements_item_idx').on(table.itemId),
  index('stock_movements_warehouse_idx').on(table.warehouseId),
  index('stock_movements_created_at_idx').on(table.createdAt),
  index('stock_movements_reference_idx').on(table.referenceType, table.referenceId),
])

/* ------------------------------------------------------------------ */
/* Stock Levels                                                       */
/* ------------------------------------------------------------------ */

export const stockLevels = pgTable('stockLevels', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  itemId: text('item_id').notNull(),
  warehouseId: text('warehouse_id').notNull(),
  quantityOnHand: numeric('quantity_on_hand', { precision: 18, scale: 3 }).notNull().default('0'),
  quantityReserved: numeric('quantity_reserved', { precision: 18, scale: 3 }).notNull().default('0'),
  quantityAvailable: numeric('quantity_available', { precision: 18, scale: 3 }).notNull().default('0'),
  lastMovementAt: timestamp('last_movement_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('stock_levels_item_warehouse_uq').on(table.businessId, table.itemId, table.warehouseId),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'stock_levels_item_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouses.id],
    name: 'stock_levels_warehouse_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'stock_levels_business_fk',
  }).onDelete('cascade'),
  index('stock_levels_business_idx').on(table.businessId),
  index('stock_levels_item_idx').on(table.itemId),
  index('stock_levels_warehouse_idx').on(table.warehouseId),
])

/* ------------------------------------------------------------------ */
/* Purchase Orders                                                    */
/* ------------------------------------------------------------------ */

export const purchaseOrders = pgTable('purchaseOrders', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  supplierId: text('supplier_id').notNull(),
  warehouseId: text('warehouse_id').notNull(),
  number: text('number').notNull(),
  status: text('status').notNull().default('draft'),
  orderDate: date('order_date').notNull(),
  expectedDate: date('expected_date'),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 18, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('UGX'),
  notes: text('notes'),
  createdBy: text('created_by').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('purchase_orders_status_valid', sql`${table.status} IN ('draft','submitted','approved','rejected','partially_received','completed','cancelled')`),
  foreignKey({
    columns: [table.supplierId],
    foreignColumns: [suppliers.id],
    name: 'purchase_orders_supplier_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouses.id],
    name: 'purchase_orders_warehouse_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'purchase_orders_created_by_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.approvedBy],
    foreignColumns: [user.id],
    name: 'purchase_orders_approved_by_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'purchase_orders_business_fk',
  }).onDelete('cascade'),
  unique('purchase_orders_number_business_uq').on(table.businessId, table.number),
  index('purchase_orders_business_idx').on(table.businessId),
  index('purchase_orders_supplier_idx').on(table.supplierId),
  index('purchase_orders_warehouse_idx').on(table.warehouseId),
  index('purchase_orders_status_idx').on(table.status),
  index('purchase_orders_created_at_idx').on(table.createdAt),
])

/* ------------------------------------------------------------------ */
/* Purchase Order Lines                                               */
/* ------------------------------------------------------------------ */

export const purchaseOrderLines = pgTable('purchaseOrderLines', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  purchaseOrderId: text('purchase_order_id').notNull(),
  itemId: text('item_id').notNull(),
  description: text('description').notNull(),
  quantityOrdered: numeric('quantity_ordered', { precision: 18, scale: 3 }).notNull(),
  quantityReceived: numeric('quantity_received', { precision: 18, scale: 3 }).notNull().default('0'),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
  lineTotal: numeric('line_total', { precision: 18, scale: 2 }).notNull().default('0'),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('purchase_order_lines_quantity_positive', sql`${table.quantityOrdered} > 0`),
  check('purchase_order_lines_unit_price_positive', sql`${table.unitPrice} >= 0`),
  check('purchase_order_lines_line_total_positive', sql`${table.lineTotal} >= 0`),
  foreignKey({
    columns: [table.purchaseOrderId],
    foreignColumns: [purchaseOrders.id],
    name: 'purchase_order_lines_po_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'purchase_order_lines_item_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'purchase_order_lines_business_fk',
  }).onDelete('cascade'),
  index('purchase_order_lines_po_idx').on(table.purchaseOrderId),
  index('purchase_order_lines_item_idx').on(table.itemId),
  index('purchase_order_lines_business_idx').on(table.businessId),
])

/* ------------------------------------------------------------------ */
/* Goods Receipts                                                     */
/* ------------------------------------------------------------------ */

export const goodsReceipts = pgTable('goodsReceipts', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  purchaseOrderId: text('purchase_order_id').notNull(),
  supplierId: text('supplier_id').notNull(),
  warehouseId: text('warehouse_id').notNull(),
  number: text('number').notNull(),
  receivedDate: date('received_date').notNull(),
  status: text('status').notNull().default('draft'),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 18, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  receivedBy: text('received_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('goods_receipts_status_valid', sql`${table.status} IN ('draft','submitted','completed','cancelled')`),
  foreignKey({
    columns: [table.purchaseOrderId],
    foreignColumns: [purchaseOrders.id],
    name: 'goods_receipts_po_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.supplierId],
    foreignColumns: [suppliers.id],
    name: 'goods_receipts_supplier_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouses.id],
    name: 'goods_receipts_warehouse_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.receivedBy],
    foreignColumns: [user.id],
    name: 'goods_receipts_received_by_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'goods_receipts_business_fk',
  }).onDelete('cascade'),
  unique('goods_receipts_number_business_uq').on(table.businessId, table.number),
  index('goods_receipts_business_idx').on(table.businessId),
  index('goods_receipts_po_idx').on(table.purchaseOrderId),
  index('goods_receipts_supplier_idx').on(table.supplierId),
  index('goods_receipts_warehouse_idx').on(table.warehouseId),
  index('goods_receipts_status_idx').on(table.status),
  index('goods_receipts_created_at_idx').on(table.createdAt),
])

/* ------------------------------------------------------------------ */
/* Goods Receipt Lines                                                */
/* ------------------------------------------------------------------ */

export const goodsReceiptLines = pgTable('goodsReceiptLines', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  goodsReceiptId: text('goods_receipt_id').notNull(),
  purchaseOrderLineId: text('purchase_order_line_id').notNull(),
  itemId: text('item_id').notNull(),
  quantityReceived: numeric('quantity_received', { precision: 18, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
  lineTotal: numeric('line_total', { precision: 18, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('goods_receipt_lines_quantity_positive', sql`${table.quantityReceived} > 0`),
  check('goods_receipt_lines_unit_price_positive', sql`${table.unitPrice} >= 0`),
  check('goods_receipt_lines_line_total_positive', sql`${table.lineTotal} >= 0`),
  foreignKey({
    columns: [table.goodsReceiptId],
    foreignColumns: [goodsReceipts.id],
    name: 'goods_receipt_lines_gr_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.purchaseOrderLineId],
    foreignColumns: [purchaseOrderLines.id],
    name: 'goods_receipt_lines_po_line_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'goods_receipt_lines_item_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'goods_receipt_lines_business_fk',
  }).onDelete('cascade'),
  index('goods_receipt_lines_gr_idx').on(table.goodsReceiptId),
  index('goods_receipt_lines_po_line_idx').on(table.purchaseOrderLineId),
  index('goods_receipt_lines_item_idx').on(table.itemId),
  index('goods_receipt_lines_business_idx').on(table.businessId),
])

/* ------------------------------------------------------------------ */
/* Purchase Returns                                                   */
/* ------------------------------------------------------------------ */

export const purchaseReturns = pgTable('purchaseReturns', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  purchaseOrderId: text('purchase_order_id').notNull(),
  supplierId: text('supplier_id').notNull(),
  warehouseId: text('warehouse_id').notNull(),
  number: text('number').notNull(),
  returnDate: date('return_date').notNull(),
  status: text('status').notNull().default('draft'),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 18, scale: 2 }).notNull().default('0'),
  reason: text('reason'),
  notes: text('notes'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('purchase_returns_status_valid', sql`${table.status} IN ('draft','submitted','completed','cancelled')`),
  foreignKey({
    columns: [table.purchaseOrderId],
    foreignColumns: [purchaseOrders.id],
    name: 'purchase_returns_po_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.supplierId],
    foreignColumns: [suppliers.id],
    name: 'purchase_returns_supplier_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouses.id],
    name: 'purchase_returns_warehouse_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'purchase_returns_created_by_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'purchase_returns_business_fk',
  }).onDelete('cascade'),
  unique('purchase_returns_number_business_uq').on(table.businessId, table.number),
  index('purchase_returns_business_idx').on(table.businessId),
  index('purchase_returns_po_idx').on(table.purchaseOrderId),
  index('purchase_returns_supplier_idx').on(table.supplierId),
  index('purchase_returns_status_idx').on(table.status),
  index('purchase_returns_created_at_idx').on(table.createdAt),
])

/* ------------------------------------------------------------------ */
/* Purchase Return Lines                                              */
/* ------------------------------------------------------------------ */

export const purchaseReturnLines = pgTable('purchaseReturnLines', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  purchaseReturnId: text('purchase_return_id').notNull(),
  itemId: text('item_id').notNull(),
  quantityReturned: numeric('quantity_returned', { precision: 18, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
  lineTotal: numeric('line_total', { precision: 18, scale: 2 }).notNull().default('0'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('purchase_return_lines_quantity_positive', sql`${table.quantityReturned} > 0`),
  check('purchase_return_lines_unit_price_positive', sql`${table.unitPrice} >= 0`),
  check('purchase_return_lines_line_total_positive', sql`${table.lineTotal} >= 0`),
  foreignKey({
    columns: [table.purchaseReturnId],
    foreignColumns: [purchaseReturns.id],
    name: 'purchase_return_lines_return_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'purchase_return_lines_item_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'purchase_return_lines_business_fk',
  }).onDelete('cascade'),
  index('purchase_return_lines_return_idx').on(table.purchaseReturnId),
  index('purchase_return_lines_item_idx').on(table.itemId),
  index('purchase_return_lines_business_idx').on(table.businessId),
])

import { boolean, check, date, foreignKey, index, jsonb, numeric, pgTable, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const user = pgTable('user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false), image: text('image'),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('memberships_role_valid', sql`${table.role} IN ('owner','administrator','finance_manager','accountant','sales_officer','cashier','viewer')`),
  unique('memberships_business_user_uq').on(table.businessId, table.userId),
  index('memberships_user_idx').on(table.userId),
  index('memberships_business_idx').on(table.businessId),
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
  }).onDelete('cascade'),
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
  }).onDelete('cascade'),
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
  }).onDelete('cascade'),
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
  }).onDelete('cascade'),
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
  }).onDelete('cascade'),
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
  }).onDelete('cascade'),
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
  }).onDelete('cascade'),
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
  check('document_sequences_type_valid', sql`${table.documentType} IN ('invoice','receipt')`),
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
  }).onDelete('cascade'),
  index('audit_logs_business_idx').on(table.businessId),
  index('audit_logs_user_idx').on(table.userId),
  index('audit_logs_created_at_idx').on(table.createdAt),
])

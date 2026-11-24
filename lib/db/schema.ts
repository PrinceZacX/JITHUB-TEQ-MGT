import { boolean, check, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core'
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
  quotationPrefix: text('quotation_prefix').notNull().default('QTN'),
  salesOrderPrefix: text('sales_order_prefix').notNull().default('SO'),
  serviceTicketPrefix: text('service_ticket_prefix').notNull().default('ST'),
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
  title: text('title'),
  status: text('status').notNull().default('draft'),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  currency: text('currency').notNull().default('UGX'),
  taxTreatment: text('tax_treatment').notNull().default('standard'),
  poReference: text('po_reference'),
  paymentTerms: text('payment_terms'),
  notes: text('notes'),
  termsAndConditions: text('terms_and_conditions'),
  taxInclusive: boolean('tax_inclusive').notNull().default(false),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  discountAmount: numeric('discount_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  discountType: text('discount_type').notNull().default('percentage'),
  otherCharges: numeric('other_charges', { precision: 18, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 18, scale: 2 }).notNull().default('0'),
  amountPaid: numeric('amount_paid', { precision: 18, scale: 2 }).notNull().default('0'),
  creditedAmount: numeric('credited_amount', { precision: 18, scale: 2 }).notNull().default('0'),
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
  taxType: text('tax_type').notNull().default('standard'),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
  discountPercentage: numeric('discount_percentage', { precision: 7, scale: 4 }).notNull().default('0'),
  discountAmount: numeric('discount_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  lineTotal: numeric('line_total', { precision: 18, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
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
  averageCost: numeric('average_cost', { precision: 18, scale: 4 }).notNull().default('0'),
  averageCostCurrency: text('average_cost_currency').notNull().default('UGX'),
  costingMethod: text('costing_method'), // 'fifo', 'weighted_average', or NULL for group default
  taxRateId: text('tax_rate_id'),
  valuationGroupId: text('valuation_group_id'),
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
  quantityUnavailable: numeric('quantity_unavailable', { precision: 18, scale: 3 }).notNull().default('0'),
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

/* ------------------------------------------------------------------ */
/* Credit Notes                                                       */
/* ------------------------------------------------------------------ */

export const creditNoteStatuses = ['draft', 'issued', 'cancelled'] as const
export type CreditNoteStatus = (typeof creditNoteStatuses)[number]

export const creditNotes = pgTable('creditNotes', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  invoiceId: text('invoice_id').notNull(),
  customerId: text('customer_id').notNull(),
  number: text('number').notNull(),
  status: text('status').notNull().default('draft'),
  reason: text('reason').notNull(),
  issueDate: date('issue_date').notNull(),
  currency: text('currency').notNull().default('UGX'),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 18, scale: 2 }).notNull().default('0'),
  creditedAmount: numeric('credited_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('credit_notes_status_valid', sql`${table.status} IN ('draft','issued','cancelled')`),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'credit_notes_business_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.businessId, table.invoiceId],
    foreignColumns: [invoices.businessId, invoices.id],
    name: 'credit_notes_invoice_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.businessId, table.customerId],
    foreignColumns: [customers.businessId, customers.id],
    name: 'credit_notes_customer_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'credit_notes_created_by_fk',
  }).onDelete('restrict'),
  unique('credit_notes_number_business_uq').on(table.businessId, table.number),
  unique('credit_notes_business_id_uq').on(table.businessId, table.id),
  index('credit_notes_business_idx').on(table.businessId),
  index('credit_notes_invoice_idx').on(table.invoiceId),
  index('credit_notes_customer_idx').on(table.customerId),
  index('credit_notes_status_idx').on(table.status),
])

export const creditNoteItems = pgTable('creditNoteItems', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  creditNoteId: text('credit_note_id').notNull(),
  invoiceItemId: text('invoice_item_id'),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  taxType: text('tax_type').notNull().default('standard'),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
  lineTotal: numeric('line_total', { precision: 18, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('credit_note_items_quantity_positive', sql`${table.quantity} > 0`),
  check('credit_note_items_unit_price_nonnegative', sql`${table.unitPrice} >= 0`),
  check('credit_note_items_line_total_nonnegative', sql`${table.lineTotal} >= 0`),
  foreignKey({
    columns: [table.businessId, table.creditNoteId],
    foreignColumns: [creditNotes.businessId, creditNotes.id],
    name: 'credit_note_items_cn_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'credit_note_items_business_fk',
  }).onDelete('restrict'),
  index('credit_note_items_cn_idx').on(table.creditNoteId),
  index('credit_note_items_business_idx').on(table.businessId),
])

/* ------------------------------------------------------------------ */
/* Quotations                                                         */
/* ------------------------------------------------------------------ */

export const quotations = pgTable('quotations', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  customerId: text('customer_id').notNull(),
  number: text('number').notNull(),
  status: text('status').notNull().default('draft'),
  issueDate: date('issue_date').notNull().defaultNow(),
  validUntil: date('valid_until').notNull(),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 18, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('UGX'),
  notes: text('notes'),
  terms: text('terms'),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedBy: text('accepted_by').references(() => user.id, { onDelete: 'set null' }),
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  convertedSalesOrderId: text('converted_sales_order_id'),
}, (table) => [
  check('quotations_status_valid', sql`${table.status} IN ('draft','sent','accepted','expired','converted','cancelled')`),
  unique('quotations_number_business_uq').on(table.businessId, table.number),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'quotations_business_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'quotations_customer_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'quotations_created_by_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.acceptedBy],
    foreignColumns: [user.id],
    name: 'quotations_accepted_by_fk',
  }).onDelete('set null'),
  index('quotations_business_idx').on(table.businessId),
  index('quotations_customer_idx').on(table.customerId),
  index('quotations_status_idx').on(table.status),
  index('quotations_created_at_idx').on(table.createdAt),
  index('quotations_valid_until_idx').on(table.validUntil),
])

// Quotation Items
export const quotationItems = pgTable('quotation_items', {
  id: text('id').primaryKey(),
  quotationId: text('quotation_id').notNull().references(() => quotations.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'restrict' }),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  lineTotal: numeric('line_total', { precision: 18, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('quotation_items_quotation_idx').on(table.quotationId),
  index('quotation_items_item_idx').on(table.itemId),
])

export const salesOrders = pgTable('sales_orders', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  quotationId: text('quotation_id').references(() => quotations.id, { onDelete: 'set null' }),
  customerId: text('customer_id').notNull(),
  warehouseId: text('warehouse_id').notNull(),
  number: text('number').notNull(),
  status: text('status').notNull().default('draft'), // draft, confirmed, partially_fulfilled, fulfilled, cancelled
  orderDate: date('order_date').notNull().defaultNow(),
  expectedDate: date('expected_date'),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 18, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('UGX'),
  notes: text('notes'),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'restrict' }),
  confirmedBy: text('confirmed_by').references(() => user.id, { onDelete: 'set null' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('sales_orders_status_valid', sql`${table.status} IN ('draft','confirmed','partially_fulfilled','fulfilled','cancelled')`),
  unique('sales_orders_number_business_uq').on(table.businessId, table.number),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'sales_orders_business_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'sales_orders_customer_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouses.id],
    name: 'sales_orders_warehouse_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'sales_orders_created_by_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.confirmedBy],
    foreignColumns: [user.id],
    name: 'sales_orders_confirmed_by_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.quotationId],
    foreignColumns: [quotations.id],
    name: 'sales_orders_quotation_fk',
  }).onDelete('set null'),
  index('sales_orders_business_idx').on(table.businessId),
  index('sales_orders_customer_idx').on(table.customerId),
  index('sales_orders_warehouse_idx').on(table.warehouseId),
  index('sales_orders_status_idx').on(table.status),
  index('sales_orders_quotation_idx').on(table.quotationId),
  index('sales_orders_created_at_idx').on(table.createdAt),
])

export const salesOrderItems = pgTable('sales_order_items', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  salesOrderId: text('sales_order_id').notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'restrict' }),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'),
  quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
  quantityFulfilled: numeric('quantity_fulfilled', { precision: 18, scale: 3 }).notNull().default('0'),
  quantityReserved: numeric('quantity_reserved', { precision: 18, scale: 3 }).notNull().default('0'),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  lineTotal: numeric('line_total', { precision: 18, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sales_order_items_order_idx').on(table.salesOrderId),
  index('sales_order_items_item_idx').on(table.itemId),
])

export const stockReservations = pgTable('stock_reservations', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  salesOrderId: text('sales_order_id').notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  salesOrderItemId: text('sales_order_item_id').notNull().references(() => salesOrderItems.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'restrict' }),
  warehouseId: text('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'restrict' }),
  quantityReserved: numeric('quantity_reserved', { precision: 18, scale: 3 }).notNull(),
  quantityFulfilled: numeric('quantity_fulfilled', { precision: 18, scale: 3 }).notNull().default('0'),
  status: text('status').notNull().default('active'), // active, partially_fulfilled, fulfilled, released, cancelled
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  releasedBy: text('released_by').references(() => user.id, { onDelete: 'set null' }),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'restrict' }),
}, (table) => [
  check('stock_reservations_status_valid', sql`${table.status} IN ('active','partially_fulfilled','fulfilled','released','cancelled')`),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'stock_reservations_business_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.salesOrderId],
    foreignColumns: [salesOrders.id],
    name: 'stock_reservations_sales_order_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.salesOrderItemId],
    foreignColumns: [salesOrderItems.id],
    name: 'stock_reservations_sales_order_item_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'stock_reservations_item_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouses.id],
    name: 'stock_reservations_warehouse_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.releasedBy],
    foreignColumns: [user.id],
    name: 'stock_reservations_released_by_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'stock_reservations_created_by_fk',
  }).onDelete('restrict'),
  index('stock_reservations_business_idx').on(table.businessId),
  index('stock_reservations_sales_order_idx').on(table.salesOrderId),
  index('stock_reservations_sales_order_item_idx').on(table.salesOrderItemId),
  index('stock_reservations_item_idx').on(table.itemId),
  index('stock_reservations_warehouse_idx').on(table.warehouseId),
  index('stock_reservations_status_idx').on(table.status),
])

export const costingLayers = pgTable('costing_layers', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'restrict' }),
  warehouseId: text('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'restrict' }),
  quantityReceived: numeric('quantity_received', { precision: 18, scale: 3 }).notNull(),
  quantityRemaining: numeric('quantity_remaining', { precision: 18, scale: 3 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  unitCostCurrency: text('unit_cost_currency').notNull().default('UGX'),
  receivedDate: date('received_date').notNull(),
  sourceType: text('source_type').notNull(), // 'purchase', 'adjustment', 'return', 'transfer_in', 'opening_balance'
  sourceReferenceId: text('source_reference_id'),
  sourceReferenceType: text('source_reference_type'), // 'purchase_order', 'goods_receipt', 'adjustment', 'transfer'
  valuationGroupId: text('valuation_group_id').references(() => valuationGroups.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'costing_layers_business_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'costing_layers_item_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouses.id],
    name: 'costing_layers_warehouse_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.valuationGroupId],
    foreignColumns: [valuationGroups.id],
    name: 'costing_layers_valuation_group_fk',
  }).onDelete('set null'),
  index('costing_layers_business_idx').on(table.businessId),
  index('costing_layers_item_warehouse_idx').on(table.itemId, table.warehouseId),
  index('costing_layers_valuation_group_idx').on(table.valuationGroupId),
  index('costing_layers_received_date_idx').on(table.receivedDate),
  index('costing_layers_active_idx').on(table.isActive),
  index('costing_layers_remaining_idx').on(table.quantityRemaining),
])

export const valuationGroups = pgTable('valuation_groups', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  costingMethod: text('costing_method').notNull(), // 'fifo', 'weighted_average'
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'valuation_groups_business_fk',
  }).onDelete('cascade'),
  unique('valuation_groups_business_name_uq').on(table.businessId, table.name),
  index('valuation_groups_business_idx').on(table.businessId),
])

/* ------------------------------------------------------------------ */
/* Service Desk - Service Tickets                                     */
/* ------------------------------------------------------------------ */

export const serviceTicketStatuses = ['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled'] as const
export type ServiceTicketStatus = (typeof serviceTicketStatuses)[number]

export const serviceTicketPriorities = ['low', 'normal', 'high', 'critical', 'urgent'] as const
export type ServiceTicketPriority = (typeof serviceTicketPriorities)[number]

export const serviceTickets = pgTable('service_tickets', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  customerId: text('customer_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('normal'),
  assigneeUserId: text('assignee_user_id'),
  relatedInvoiceId: text('related_invoice_id'),
  relatedQuotationId: text('related_quotation_id'),
  relatedServiceOrderId: text('related_service_order_id'),
  slaPolicyId: text('sla_policy_id'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, (table) => [
  check('service_tickets_status_valid', sql`${table.status} IN ('open','in_progress','on_hold','resolved','closed','cancelled')`),
  check('service_tickets_priority_valid', sql`${table.priority} IN ('low','normal','high','critical','urgent')`),
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'service_tickets_business_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.businessId, table.customerId],
    foreignColumns: [customers.businessId, customers.id],
    name: 'service_tickets_customer_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.businessId, table.relatedInvoiceId],
    foreignColumns: [invoices.businessId, invoices.id],
    name: 'service_tickets_invoice_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.businessId, table.relatedQuotationId],
    foreignColumns: [quotations.businessId, quotations.id],
    name: 'service_tickets_quotation_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'service_tickets_created_by_fk',
  }).onDelete('restrict'),
  index('service_tickets_business_idx').on(table.businessId),
  index('service_tickets_customer_idx').on(table.customerId),
  index('service_tickets_status_idx').on(table.status),
  index('service_tickets_priority_idx').on(table.priority),
  index('service_tickets_assignee_idx').on(table.assigneeUserId),
  index('service_tickets_created_by_idx').on(table.createdBy),
  index('service_tickets_created_at_idx').on(table.createdAt),
])

/* ------------------------------------------------------------------ */
/* Service Desk - Ticket Comments                                     */
/* ------------------------------------------------------------------ */

export const serviceTicketComments = pgTable('service_ticket_comments', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  ticketId: text('ticket_id').notNull(),
  authorUserId: text('author_user_id').notNull(),
  body: text('body').notNull(),
  isInternal: boolean('is_internal').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'service_ticket_comments_business_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.businessId, table.ticketId],
    foreignColumns: [serviceTickets.businessId, serviceTickets.id],
    name: 'service_ticket_comments_ticket_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.authorUserId],
    foreignColumns: [user.id],
    name: 'service_ticket_comments_author_fk',
  }).onDelete('restrict'),
  index('service_ticket_comments_business_idx').on(table.businessId),
  index('service_ticket_comments_ticket_idx').on(table.ticketId),
  index('service_ticket_comments_author_idx').on(table.authorUserId),
  index('service_ticket_comments_created_at_idx').on(table.createdAt),
])

/* ------------------------------------------------------------------ */
/* Service Desk - Ticket Events (Audit Trail)                         */
/* ------------------------------------------------------------------ */

export const serviceTicketEvents = pgTable('service_ticket_events', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  ticketId: text('ticket_id').notNull(),
  actorUserId: text('actor_user_id').notNull(),
  eventType: text('event_type').notNull(),
  fromValue: text('from_value'),
  toValue: text('to_value'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'service_ticket_events_business_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.businessId, table.ticketId],
    foreignColumns: [serviceTickets.businessId, serviceTickets.id],
    name: 'service_ticket_events_ticket_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.actorUserId],
    foreignColumns: [user.id],
    name: 'service_ticket_events_actor_fk',
  }).onDelete('restrict'),
  index('service_ticket_events_business_idx').on(table.businessId),
  index('service_ticket_events_ticket_idx').on(table.ticketId),
  index('service_ticket_events_actor_idx').on(table.actorUserId),
  index('service_ticket_events_created_at_idx').on(table.createdAt),
  index('service_ticket_events_type_idx').on(table.eventType),
])

/* ------------------------------------------------------------------ */
/* Service Desk - Ticket Attachments                                  */
/* ------------------------------------------------------------------ */

export const serviceTicketAttachments = pgTable('service_ticket_attachments', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  ticketId: text('ticket_id').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storageUrl: text('storage_url').notNull(),
  checksumSha256: text('checksum_sha256'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'service_ticket_attachments_business_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.businessId, table.ticketId],
    foreignColumns: [serviceTickets.businessId, serviceTickets.id],
    name: 'service_ticket_attachments_ticket_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.uploadedBy],
    foreignColumns: [user.id],
    name: 'service_ticket_attachments_uploaded_by_fk',
  }).onDelete('restrict'),
  check('service_ticket_attachments_size_positive', sql`${table.sizeBytes} > 0`),
  index('service_ticket_attachments_business_idx').on(table.businessId),
  index('service_ticket_attachments_ticket_idx').on(table.ticketId),
  index('service_ticket_attachments_uploaded_by_idx').on(table.uploadedBy),
])

/* ------------------------------------------------------------------ */
/* Service Desk - Service Level Policies                              */
/* ------------------------------------------------------------------ */

export const serviceLevelPolicies = pgTable('service_level_policies', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  responseMinutes: integer('response_minutes').notNull().default(60),
  resolutionMinutes: integer('resolution_minutes').notNull().default(480),
  isDefault: boolean('is_default').notNull().default(false),
  appliesToPriorities: text('applies_to_priorities').array().notNull().default(sql`'{"low","normal","high","critical","urgent"}'`),
  businessHoursOnly: boolean('business_hours_only').notNull().default(true),
  timezone: text('timezone').notNull().default('Africa/Kampala'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'service_level_policies_business_fk',
  }).onDelete('restrict'),
  check('service_level_policies_response_positive', sql`${table.responseMinutes} > 0`),
  check('service_level_policies_resolution_positive', sql`${table.resolutionMinutes} > 0`),
  index('service_level_policies_business_idx').on(table.businessId),
  index('service_level_policies_business_default_idx').on(table.businessId, table.isDefault),
])

/* ------------------------------------------------------------------ */
/* Service Desk - Business Invitations                                */
/* ------------------------------------------------------------------ */

export const businessInvitationStatuses = ['pending', 'accepted', 'expired', 'revoked'] as const
export type BusinessInvitationStatus = (typeof businessInvitationStatuses)[number]

export const businessInvitations = pgTable('business_invitations', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('viewer'),
  tokenHash: text('token_hash').notNull(),
  invitedBy: text('invited_by').notNull(),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedByUserId: text('accepted_by_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.businessId],
    foreignColumns: [businesses.id],
    name: 'business_invitations_business_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.invitedBy],
    foreignColumns: [user.id],
    name: 'business_invitations_invited_by_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.acceptedByUserId],
    foreignColumns: [user.id],
    name: 'business_invitations_accepted_by_fk',
  }).onDelete('set null'),
  check('business_invitations_role_valid', sql`${table.role} IN ('owner','administrator','finance_manager','accountant','sales_officer','cashier','viewer')`),
  check('business_invitations_status_valid', sql`${table.status} IN ('pending','accepted','expired','revoked')`),
  unique('business_invitations_email_business_uq').on(table.businessId, table.email),
  index('business_invitations_business_idx').on(table.businessId),
  index('business_invitations_email_idx').on(table.email),
  index('business_invitations_token_hash_idx').on(table.tokenHash),
  index('business_invitations_status_idx').on(table.status),
  index('business_invitations_expires_at_idx').on(table.expiresAt),
])

/* ------------------------------------------------------------------ */
/* Businesses - Service Ticket Prefix                                 */
/* ------------------------------------------------------------------ */

// Add serviceTicketPrefix to businesses table
// This is done via migration 0013



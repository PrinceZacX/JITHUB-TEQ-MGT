import { boolean, date, index, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
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
export const customers = pgTable('customers', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), name: text('name').notNull(), email: text('email'), phone: text('phone'), address: text('address'), taxId: text('tax_id'), status: text('status').notNull().default('active'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const catalogueItems = pgTable('catalogue_items', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), name: text('name').notNull(), description: text('description'), unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(), status: text('status').notNull().default('active'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), customerId: text('customer_id').notNull(), number: text('number').notNull(), status: text('status').notNull().default('draft'), issueDate: date('issue_date').notNull(), dueDate: date('due_date').notNull(), currency: text('currency').notNull().default('UGX'), subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull().default('0'), taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'), total: numeric('total', { precision: 18, scale: 2 }).notNull().default('0'), amountPaid: numeric('amount_paid', { precision: 18, scale: 2 }).notNull().default('0'), notes: text('notes'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const invoiceItems = pgTable('invoice_items', {
  id: text('id').primaryKey(), invoiceId: text('invoice_id').notNull(), description: text('description').notNull(), quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(), unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(), taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'), lineTotal: numeric('line_total', { precision: 18, scale: 2 }).notNull(),
})
export const payments = pgTable('payments', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), customerId: text('customer_id').notNull(), reference: text('reference'), method: text('method').notNull(), paidAt: date('paid_at').notNull(), amount: numeric('amount', { precision: 18, scale: 2 }).notNull(), currency: text('currency').notNull().default('UGX'), notes: text('notes'), status: text('status').notNull().default('confirmed'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('payments_user_reference_uq').on(table.userId, table.reference).where(sql`${table.reference} IS NOT NULL`), index('payments_user_paid_at_idx').on(table.userId, table.paidAt)])
export const paymentAllocations = pgTable('payment_allocations', {
  id: text('id').primaryKey(), paymentId: text('payment_id').notNull(), invoiceId: text('invoice_id').notNull(), amount: numeric('amount', { precision: 18, scale: 2 }).notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const receipts = pgTable('receipts', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), paymentId: text('payment_id').notNull(), number: text('number').notNull(), issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
})
export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), category: text('category').notNull(), payee: text('payee').notNull(), description: text('description'), method: text('method').notNull(), paidAt: date('paid_at').notNull(), amount: numeric('amount', { precision: 18, scale: 2 }).notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), action: text('action').notNull(), entityType: text('entity_type').notNull(), entityId: text('entity_id').notNull(), details: jsonb('details').notNull().default({}), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

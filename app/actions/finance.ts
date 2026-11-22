'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  auditLogs,
  businesses,
  businessMemberships,
  catalogueItems,
  customers,
  documentSequences,
  expenses,
  invoiceItems,
  invoices,
  paymentAllocations,
  payments,
  receipts,
  refunds,
} from '@/lib/db/schema'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { requirePermission, defaultRole } from '@/lib/permissions'
import { loadEnv } from '@/lib/env'

const moneyPattern = /^\d{1,12}(\.\d{1,2})?$/

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Please sign in to continue.')
  return session.user.id
}

function money(value: string) {
  if (!moneyPattern.test(value)) throw new Error('Enter a valid amount with up to two decimal places.')
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1900 || year > 2200) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function scaledDecimal(value: unknown, scale: number, label: string) {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`${label} must be a number.`)
  const multiplier = 10 ** scale
  const scaled = Math.round(Number(value) * multiplier)
  if (Math.abs(Number(value) * multiplier - scaled) > 1e-6) throw new Error(`${label} exceeds ${scale} decimal places.`)
  return BigInt(scaled)
}

/**
 * Resolve the caller's active business and role. The user must have an
 * accepted membership; the first membership becomes their working business.
 * Future work: let the user switch between businesses.
 */
async function requireBusiness() {
  loadEnv()
  const userId = await requireUser()
  const [membership] = await db
    .select({
      id: businessMemberships.id,
      businessId: businessMemberships.businessId,
      userId: businessMemberships.userId,
      role: businessMemberships.role,
      businessStatus: businesses.status,
    })
    .from(businessMemberships)
    .innerJoin(businesses, eq(businesses.id, businessMemberships.businessId))
    .where(and(eq(businessMemberships.userId, userId), eq(businesses.status, 'active')))
    .limit(1)
  if (!membership) throw new Error('You are not a member of an active business.')
  return {
    userId,
    businessId: membership.businessId,
    role: membership.role as 'owner' | 'administrator' | 'finance_manager' | 'accountant' | 'sales_officer' | 'cashier' | 'viewer',
  }
}

async function requireBusinessPermission(permission: string) {
  const context = await requireBusiness()
  requirePermission(context.role, permission as any)
  return context
}

async function insertAudit(tx: any, context: { userId: string; businessId: string }, input: {
  action: string; entityType: string; entityId: string; details?: Record<string, unknown> }) {
  await tx.insert(auditLogs).values({
    id: randomUUID(),
    businessId: context.businessId,
    userId: context.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: input.details ?? {},
  })
}

async function allocateDocumentNumber(tx: any, businessId: string, documentType: 'invoice' | 'receipt') {
  const now = new Date()
  const year = now.getFullYear()
  const [row] = await tx
    .select()
    .from(documentSequences)
    .where(and(eq(documentSequences.businessId, businessId), eq(documentSequences.documentType, documentType)))
    .for('update')
    .limit(1)
  const [business] = await tx.select({ invoicePrefix: businesses.invoicePrefix, receiptPrefix: businesses.receiptPrefix }).from(businesses).where(eq(businesses.id, businessId)).limit(1)
  if (!business) throw new Error('Business not found.')
  const prefix = documentType === 'invoice' ? business.invoicePrefix : business.receiptPrefix
  const next = Number(row?.lastNumber ?? 0) + 1
  const padded = String(next).padStart(6, '0')
  const number = `${prefix}-${year}-${padded}`
  if (row) {
    await tx.update(documentSequences).set({ lastNumber: String(next), updatedAt: now }).where(eq(documentSequences.id, row.id))
  } else {
    await tx.insert(documentSequences).values({
      id: randomUUID(),
      businessId,
      documentType,
      lastNumber: String(next),
      updatedAt: now,
    })
  }
  return number
}

export async function getDashboardData() {
  const context = await requireBusiness()
  const { userId, businessId } = context
  const [customersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(customers).where(eq(customers.businessId, businessId))
  const [summary] = await db.select({
    invoiced: sql<string>`coalesce(sum(case when ${invoices.status} not in ('draft','cancelled') then ${invoices.total} else 0 end),0)`,
    received: sql<string>`coalesce(sum(${invoices.amountPaid}),0)`,
    outstanding: sql<string>`coalesce(sum(case when ${invoices.status} not in ('draft','cancelled') then ${invoices.total} - ${invoices.amountPaid} else 0 end),0)`,
    overdue: sql<number>`count(*) filter (where ${invoices.status} in ('issued','partially_paid','overdue') and ${invoices.dueDate} < current_date and ${invoices.amountPaid} < ${invoices.total})::int`,
  }).from(invoices).where(eq(invoices.businessId, businessId))
  const trend = await db.select({ month: sql<string>`to_char(date_trunc('month', ${payments.paidAt}::date), 'Mon')`, amount: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.businessId, businessId), sql`${payments.paidAt}::date >= date_trunc('month', current_date) - interval '5 months'`)).groupBy(sql`date_trunc('month', ${payments.paidAt}::date)`).orderBy(sql`date_trunc('month', ${payments.paidAt}::date)`)
  const recentInvoices = await db.select({ id: invoices.id, number: invoices.number, total: invoices.total, amountPaid: invoices.amountPaid, status: sql<string>`case when ${invoices.status} in ('issued','partially_paid','overdue') and ${invoices.dueDate} < current_date and ${invoices.amountPaid} < ${invoices.total} then 'overdue' else ${invoices.status} end`, issueDate: invoices.issueDate, dueDate: invoices.dueDate, customer: customers.name }).from(invoices).innerJoin(customers, and(eq(invoices.customerId, customers.id), eq(customers.businessId, businessId))).where(eq(invoices.businessId, businessId)).orderBy(desc(invoices.createdAt)).limit(50)
  const recentCustomers = await db.select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone, address: customers.address, createdAt: customers.createdAt }).from(customers).where(eq(customers.businessId, businessId)).orderBy(desc(customers.createdAt)).limit(100)
  const recentReceipts = await db.select({ id: receipts.id, number: receipts.number, status: receipts.status, amount: payments.amount, method: payments.method, paidAt: payments.paidAt, reference: payments.reference, customer: customers.name }).from(receipts).innerJoin(payments, and(eq(receipts.paymentId, payments.id), eq(payments.businessId, businessId))).innerJoin(customers, and(eq(payments.customerId, customers.id), eq(customers.businessId, businessId))).where(eq(receipts.businessId, businessId)).orderBy(desc(receipts.issuedAt)).limit(100)
  const recentExpenses = await db.select({ id: expenses.id, category: expenses.category, payee: expenses.payee, description: expenses.description, method: expenses.method, paidAt: expenses.paidAt, amount: expenses.amount }).from(expenses).where(eq(expenses.businessId, businessId)).orderBy(desc(expenses.paidAt)).limit(100)
  const catalogue = await db.select({ id: catalogueItems.id, name: catalogueItems.name, description: catalogueItems.description, unitPrice: catalogueItems.unitPrice, status: catalogueItems.status }).from(catalogueItems).where(eq(catalogueItems.businessId, businessId)).orderBy(desc(catalogueItems.createdAt)).limit(500)
  const auditTrail = await db.select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, details: auditLogs.details, createdAt: auditLogs.createdAt }).from(auditLogs).where(eq(auditLogs.businessId, businessId)).orderBy(desc(auditLogs.createdAt)).limit(100)
  const [business] = await db.select({ id: businesses.id, name: businesses.name, legalName: businesses.legalName, email: businesses.email, phone: businesses.phone, address: businesses.address, currency: businesses.currency, city: businesses.city, country: businesses.country, receiptPrefix: businesses.receiptPrefix, invoicePrefix: businesses.invoicePrefix, logoUrl: businesses.logoUrl }).from(businesses).where(eq(businesses.id, businessId)).limit(1)
  const refundsList = await db.select({ id: refunds.id, amount: refunds.amount, reason: refunds.reason, method: refunds.method, reference: refunds.reference, status: refunds.status, createdAt: refunds.createdAt, requestedBy: refunds.requestedBy, approvedBy: refunds.approvedBy }).from(refunds).where(eq(refunds.businessId, businessId)).orderBy(desc(refunds.createdAt)).limit(50)
  return { customerCount: customersCount.count, summary, trend, invoices: recentInvoices, customers: recentCustomers, receipts: recentReceipts, expenses: recentExpenses, catalogue, auditTrail, businessId, business, refunds: refundsList }
}

export async function getFinancialReport(days: '30' | '90' | '365' | 'all') {
  const context = await requireBusinessPermission('reports.read')
  const { userId, businessId } = context
  if (!['30', '90', '365', 'all'].includes(days)) throw new Error('Choose a supported reporting period.')
  const start = new Date()
  if (days !== 'all') start.setUTCDate(start.getUTCDate() - Number(days))
  const startDate = start.toISOString().slice(0, 10)
  const invoiceScope = days === 'all' ? eq(invoices.businessId, businessId) : and(eq(invoices.businessId, businessId), gte(invoices.issueDate, startDate))
  const paymentScope = days === 'all' ? and(eq(payments.businessId, businessId), eq(payments.status, 'confirmed')) : and(eq(payments.businessId, businessId), eq(payments.status, 'confirmed'), gte(payments.paidAt, startDate))
  const expenseScope = days === 'all' ? eq(expenses.businessId, businessId) : and(eq(expenses.businessId, businessId), gte(expenses.paidAt, startDate))
  const [invoiceSummary] = await db.select({ invoiced: sql<string>`coalesce(sum(case when ${invoices.status} not in ('draft','cancelled') then ${invoices.total} else 0 end),0)`, outstanding: sql<string>`coalesce(sum(case when ${invoices.status} not in ('draft','cancelled') then ${invoices.total} - ${invoices.amountPaid} else 0 end),0)` }).from(invoices).where(invoiceScope)
  const [paymentSummary] = await db.select({ received: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(paymentScope)
  const invoiceRows = await db.select({ number: invoices.number, customer: customers.name, status: invoices.status, date: invoices.issueDate, total: invoices.total, paid: invoices.amountPaid }).from(invoices).innerJoin(customers, and(eq(invoices.customerId, customers.id), eq(customers.businessId, businessId))).where(and(invoiceScope, sql`${invoices.status} not in ('draft','cancelled')`)).orderBy(desc(invoices.issueDate))
  const paymentRows = await db.select({ receipt: receipts.number, customer: customers.name, method: payments.method, reference: payments.reference, date: payments.paidAt, amount: payments.amount }).from(payments).innerJoin(customers, and(eq(payments.customerId, customers.id), eq(customers.businessId, businessId))).innerJoin(receipts, and(eq(receipts.paymentId, payments.id), eq(receipts.businessId, businessId))).where(paymentScope).orderBy(desc(payments.paidAt))
  const expenseRows = await db.select({ category: expenses.category, payee: expenses.payee, method: expenses.method, date: expenses.paidAt, amount: expenses.amount }).from(expenses).where(expenseScope).orderBy(desc(expenses.paidAt))
  return { startDate: days === 'all' ? null : startDate, invoiced: invoiceSummary.invoiced, outstanding: invoiceSummary.outstanding, received: paymentSummary.received, invoices: invoiceRows, payments: paymentRows, expenses: expenseRows }
}

export async function createCustomer(input: { name: string; email: string; phone: string; address: string }) {
  const context = await requireBusinessPermission('customer.manage')
  const name = input.name.trim()
  const email = input.email.trim()
  if (name.length < 2 || name.length > 160) throw new Error('Customer name must be between 2 and 160 characters.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(customers).values({ id, businessId: context.businessId, userId: context.userId, name, email: email || null, phone: input.phone.trim() || null, address: input.address.trim() || null })
    await insertAudit(tx, context, { action: 'customer.created', entityType: 'customer', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

export async function updateCustomer(input: { id: string; name: string; email: string; phone: string; address: string }) {
  const context = await requireBusinessPermission('customer.manage')
  const name = input.name.trim()
  const email = input.email.trim()
  if (name.length < 2 || name.length > 160) throw new Error('Customer name must be between 2 and 160 characters.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  const [existing] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.id), eq(customers.businessId, context.businessId))).limit(1)
  if (!existing) throw new Error('Customer not found.')
  await db.transaction(async (tx) => {
    await tx.update(customers).set({ name, email: email || null, phone: input.phone.trim() || null, address: input.address.trim() || null }).where(and(eq(customers.id, input.id), eq(customers.businessId, context.businessId)))
    await insertAudit(tx, context, { action: 'customer.updated', entityType: 'customer', entityId: input.id })
  })
  revalidatePath('/')
  return { id: input.id }
}

export async function createInvoice(input: { customerId: string; description: string; quantity: string; unitPrice: string; taxRate: string; dueDate: string; status: 'draft' | 'issued' }) {
  const context = await requireBusinessPermission(input.status === 'issued' ? 'invoice.issue' : 'invoice.create')
  const [customer] = await db.select({ id: customers.id, businessId: customers.businessId }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.businessId, context.businessId))).limit(1)
  if (!customer) throw new Error('Select a customer in your account.')
  const description = input.description.trim()
  const quantityMilli = scaledDecimal(input.quantity, 3, 'Quantity')
  const taxRateBasisPoints = scaledDecimal(input.taxRate, 4, 'Tax rate')
  const quantity = Number(quantityMilli) / 1000
  const taxRate = Number(taxRateBasisPoints) / 100
  if (!description || description.length > 200) throw new Error('Add a description of up to 200 characters.')
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) throw new Error('Quantity must be greater than zero.')
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('Tax rate must be between 0 and 100 percent.')
  if (!isValidDate(input.dueDate)) throw new Error('Choose a valid due date.')
  if (input.status !== 'draft' && input.status !== 'issued') throw new Error('Choose whether to save a draft or issue the invoice.')
  const unitCents = money(input.unitPrice)
  const subtotalCents = Number((BigInt(unitCents) * quantityMilli + 500n) / 1000n)
  const taxCents = Number((BigInt(subtotalCents) * taxRateBasisPoints + 500_000n) / 1_000_000n)
  if (!Number.isSafeInteger(subtotalCents + taxCents)) throw new Error('Invoice total is too large.')
  const id = randomUUID()
  const number = await allocateDocumentNumber(db as any, context.businessId, 'invoice')
  const format = (cents: number) => (cents / 100).toFixed(2)
  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({ id, businessId: context.businessId, userId: context.userId, customerId: customer.id, number, status: input.status, issueDate: new Date().toISOString().slice(0, 10), dueDate: input.dueDate, subtotal: format(subtotalCents), taxAmount: format(taxCents), total: format(subtotalCents + taxCents) })
    await tx.insert(invoiceItems).values({ id: randomUUID(), businessId: context.businessId, invoiceId: id, description, quantity: (Number(quantityMilli) / 1000).toFixed(3), unitPrice: format(unitCents), taxRate: taxRate.toFixed(4), lineTotal: format(subtotalCents + taxCents) })
    await insertAudit(tx, context, { action: input.status === 'draft' ? 'invoice.draft_created' : 'invoice.issued', entityType: 'invoice', entityId: id, details: { number } })
  })
  revalidatePath('/')
  return { id, number, status: input.status }
}

export async function issueDraftInvoice(id: string) {
  const context = await requireBusinessPermission('invoice.issue')
  await db.transaction(async (tx) => {
    const [invoice] = await tx.select({ id: invoices.id, status: invoices.status, number: invoices.number, businessId: invoices.businessId }).from(invoices).where(and(eq(invoices.id, id), eq(invoices.businessId, context.businessId))).limit(1).for('update')
    if (!invoice || invoice.status !== 'draft') throw new Error('Only a draft invoice in your business can be issued.')
    await tx.update(invoices).set({ status: 'issued', issueDate: new Date().toISOString().slice(0, 10) }).where(and(eq(invoices.id, id), eq(invoices.businessId, context.businessId), eq(invoices.status, 'draft')))
    await insertAudit(tx, context, { action: 'invoice.issued', entityType: 'invoice', entityId: id, details: { number: invoice.number } })
  })
  revalidatePath('/')
}

export async function recordPayment(input: { invoiceId: string; amount: string; method: string; reference: string; paidAt: string; idempotencyKey?: string }) {
  const context = await requireBusinessPermission('payment.record')
  const amount = money(input.amount)
  if (amount <= 0) throw new Error('Payment must be greater than zero.')
  if (!['Cash', 'Bank transfer', 'Mobile Money', 'Card', 'Cheque', 'Other'].includes(input.method)) throw new Error('Choose a supported payment method.')
  const reference = input.reference.trim() || null
  if (reference && reference.length > 100) throw new Error('Payment reference must be 100 characters or fewer.')
  const paidDate = input.paidAt || new Date().toISOString().slice(0, 10)
  if (!isValidDate(paidDate)) throw new Error('Choose a valid payment date.')
  const idempotencyKey = input.idempotencyKey || null
  const paymentId = randomUUID()
  const receiptNumber = await allocateDocumentNumber(db as any, context.businessId, 'receipt')
  await db.transaction(async (tx) => {
    if (idempotencyKey) {
      const [existing] = await tx.select({ id: payments.id, amount: payments.amount }).from(payments).where(and(eq(payments.businessId, context.businessId), eq(payments.idempotencyKey, idempotencyKey))).limit(1)
      if (existing) throw new Error('A payment with this request key has already been recorded.')
    }
    const [invoice] = await tx.select({ id: invoices.id, status: invoices.status, total: invoices.total, amountPaid: invoices.amountPaid, customerId: invoices.customerId, businessId: invoices.businessId }).from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.businessId, context.businessId))).limit(1).for('update')
    if (!invoice || invoice.status === 'draft' || invoice.status === 'cancelled') throw new Error('The selected invoice cannot receive a payment.')
    const remaining = money(invoice.total) - money(invoice.amountPaid)
    if (amount > remaining) throw new Error('Payment exceeds the outstanding balance.')
    if (reference) {
      const [duplicate] = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.businessId, context.businessId), eq(payments.reference, reference))).limit(1)
      if (duplicate) throw new Error('This payment reference has already been recorded.')
    }
    const nextPaid = money(invoice.amountPaid) + amount
    const verificationToken = createHash('sha256').update(randomBytes(32).toString('hex') + receiptNumber).digest('hex')
    await tx.insert(payments).values({ id: paymentId, businessId: context.businessId, userId: context.userId, customerId: invoice.customerId, reference, idempotencyKey, method: input.method.toLowerCase().replace(' ', '_'), paidAt: paidDate, amount: (amount / 100).toFixed(2) })
    await tx.insert(paymentAllocations).values({ id: randomUUID(), businessId: context.businessId, paymentId, invoiceId: invoice.id, amount: (amount / 100).toFixed(2) })
    await tx.insert(receipts).values({ id: randomUUID(), businessId: context.businessId, userId: context.userId, paymentId, number: receiptNumber, verificationToken })
    await tx.update(invoices).set({ amountPaid: (nextPaid / 100).toFixed(2), status: nextPaid >= money(invoice.total) ? 'paid' : 'partially_paid' }).where(and(eq(invoices.id, invoice.id), eq(invoices.businessId, context.businessId)))
    await insertAudit(tx, context, { action: 'payment.recorded', entityType: 'payment', entityId: paymentId, details: { invoiceId: invoice.id, receiptNumber, amount: (amount / 100).toFixed(2) } })
  })
  revalidatePath('/')
  return { receiptNumber }
}

export async function saveCatalogueItem(input: { id?: string; name: string; description: string; unitPrice: string }) {
  const context = await requireBusinessPermission('catalogue.manage')
  const name = input.name.trim()
  const description = input.description.trim()
  const unitPrice = money(input.unitPrice)
  if (name.length < 2 || name.length > 160) throw new Error('Item name must be between 2 and 160 characters.')
  if (description.length > 500) throw new Error('Description must be 500 characters or fewer.')
  if (unitPrice < 0) throw new Error('Price cannot be negative.')
  const id = input.id || randomUUID()
  const values = { name, description: description || null, unitPrice: (unitPrice / 100).toFixed(2) }
  await db.transaction(async (tx) => {
    if (input.id) {
      const [existing] = await tx.select({ id: catalogueItems.id }).from(catalogueItems).where(and(eq(catalogueItems.id, input.id), eq(catalogueItems.businessId, context.businessId))).limit(1)
      if (!existing) throw new Error('Catalogue item not found.')
      await tx.update(catalogueItems).set(values).where(and(eq(catalogueItems.id, input.id), eq(catalogueItems.businessId, context.businessId)))
    } else {
      await tx.insert(catalogueItems).values({ id, businessId: context.businessId, userId: context.userId, ...values, status: 'active' })
    }
    await insertAudit(tx, context, { action: input.id ? 'catalogue_item.updated' : 'catalogue_item.created', entityType: 'catalogue_item', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

export async function setCatalogueItemStatus(input: { id: string; status: 'active' | 'inactive' }) {
  const context = await requireBusinessPermission('catalogue.manage')
  if (input.status !== 'active' && input.status !== 'inactive') throw new Error('Choose a valid catalogue status.')
  await db.transaction(async (tx) => {
    const [item] = await tx.select({ id: catalogueItems.id }).from(catalogueItems).where(and(eq(catalogueItems.id, input.id), eq(catalogueItems.businessId, context.businessId))).limit(1)
    if (!item) throw new Error('Catalogue item not found.')
    await tx.update(catalogueItems).set({ status: input.status }).where(and(eq(catalogueItems.id, input.id), eq(catalogueItems.businessId, context.businessId)))
    await insertAudit(tx, context, { action: `catalogue_item.${input.status}`, entityType: 'catalogue_item', entityId: input.id })
  })
  revalidatePath('/')
}

export async function recordExpense(input: { category: string; payee: string; description: string; method: string; paidAt: string; amount: string }) {
  const context = await requireBusinessPermission('expense.record')
  const category = input.category.trim()
  const payee = input.payee.trim()
  const amount = money(input.amount)
  if (category.length < 2 || category.length > 80) throw new Error('Choose an expense category between 2 and 80 characters.')
  if (payee.length < 2 || payee.length > 160) throw new Error('Supplier or payee must be between 2 and 160 characters.')
  if (amount <= 0) throw new Error('Expense amount must be greater than zero.')
  if (!['Cash', 'Bank transfer', 'Mobile Money', 'Card', 'Cheque', 'Other'].includes(input.method)) throw new Error('Choose a supported payment method.')
  if (!isValidDate(input.paidAt)) throw new Error('Choose a valid expense date.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(expenses).values({ id, businessId: context.businessId, userId: context.userId, category, payee, description: input.description.trim() || null, method: input.method.toLowerCase().replace(' ', '_'), paidAt: input.paidAt, amount: (amount / 100).toFixed(2) })
    await insertAudit(tx, context, { action: 'expense.recorded', entityType: 'expense', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

export async function recordRefund(input: { paymentId: string; amount: string; reason: string; method: string; reference: string; idempotencyKey?: string }) {
  const context = await requireBusinessPermission('refund.create')
  const amount = money(input.amount)
  if (amount <= 0) throw new Error('Refund amount must be greater than zero.')
  if (!input.reason.trim()) throw new Error('A refund reason is required.')
  const method = input.method.trim() || null
  const reference = input.reference.trim() || null
  const idempotencyKey = input.idempotencyKey || null
  const refundId = randomUUID()
  await db.transaction(async (tx) => {
    if (idempotencyKey) {
      const [existing] = await tx.select({ id: refunds.id }).from(refunds).where(and(eq(refunds.businessId, context.businessId), eq(refunds.idempotencyKey, idempotencyKey))).limit(1)
      if (existing) throw new Error('A refund with this request key has already been recorded.')
    }
    const [payment] = await tx.select({ id: payments.id, amount: payments.amount, status: payments.status, businessId: payments.businessId }).from(payments).where(and(eq(payments.id, input.paymentId), eq(payments.businessId, context.businessId))).limit(1).for('update')
    if (!payment || payment.status !== 'confirmed') throw new Error('Only confirmed payments can be refunded.')
    const alreadyRefunded = await tx.select({ total: sql<string>`coalesce(sum(${refunds.amount}),0)` }).from(refunds).where(and(eq(refunds.paymentId, payment.id), eq(refunds.status, 'completed'))).limit(1)
    const refundable = money(payment.amount) - money(alreadyRefunded[0]?.total ?? '0')
    if (amount > refundable) throw new Error('Refund exceeds the refundable amount.')
    await tx.insert(refunds).values({
      id: refundId, businessId: context.businessId, paymentId: payment.id, requestedBy: context.userId,
      amount: (amount / 100).toFixed(2), reason: input.reason.trim(), method, reference, status: 'pending', idempotencyKey,
    })
    await insertAudit(tx, context, { action: 'refund.requested', entityType: 'refund', entityId: refundId, details: { paymentId: payment.id, amount: (amount / 100).toFixed(2) } })
  })
  revalidatePath('/')
  return { id: refundId }
}

export async function approveRefund(input: { refundId: string; approve: boolean }) {
  const context = await requireBusinessPermission('refund.approve')
  const refundId = input.refundId
  await db.transaction(async (tx) => {
    const [refund] = await tx.select({ id: refunds.id, status: refunds.status, paymentId: refunds.paymentId, amount: refunds.amount, businessId: refunds.businessId }).from(refunds).where(and(eq(refunds.id, refundId), eq(refunds.businessId, context.businessId))).limit(1).for('update')
    if (!refund) throw new Error('Refund not found.')
    if (refund.status !== 'pending') throw new Error('Only pending refunds can be decided.')
    if (!input.approve) {
      await tx.update(refunds).set({ status: 'rejected', processedAt: new Date() }).where(eq(refunds.id, refundId))
      await insertAudit(tx, context, { action: 'refund.rejected', entityType: 'refund', entityId: refundId })
      revalidatePath('/')
      return
    }
    await tx.update(refunds).set({ status: 'approved', approvedBy: context.userId, processedAt: new Date() }).where(eq(refunds.id, refundId))
    await insertAudit(tx, context, { action: 'refund.approved', entityType: 'refund', entityId: refundId, details: { approver: context.userId } })
  })
  revalidatePath('/')
}

export async function completeRefund(input: { refundId: string }) {
  const context = await requireBusinessPermission('refund.approve')
  await db.transaction(async (tx) => {
    const [refund] = await tx.select({ id: refunds.id, status: refunds.status, amount: refunds.amount, paymentId: refunds.paymentId, businessId: refunds.businessId }).from(refunds).where(and(eq(refunds.id, input.refundId), eq(refunds.businessId, context.businessId))).limit(1).for('update')
    if (!refund || refund.status !== 'approved') throw new Error('Only approved refunds can be completed.')
    await tx.update(refunds).set({ status: 'completed', processedAt: new Date() }).where(eq(refunds.id, input.refundId))
    await insertAudit(tx, context, { action: 'refund.completed', entityType: 'refund', entityId: input.refundId, details: { amount: refund.amount, paymentId: refund.paymentId } })
  })
  revalidatePath('/')
}

export async function voidReceipt(input: { receiptId: string }) {
  const context = await requireBusinessPermission('receipt.void')
  await db.transaction(async (tx) => {
    const [receipt] = await tx.select({ id: receipts.id, status: receipts.status, paymentId: receipts.paymentId, businessId: receipts.businessId, number: receipts.number }).from(receipts).where(and(eq(receipts.id, input.receiptId), eq(receipts.businessId, context.businessId))).limit(1).for('update')
    if (!receipt) throw new Error('Receipt not found.')
    if (receipt.status === 'voided') throw new Error('Receipt is already voided.')
    await tx.update(receipts).set({ status: 'voided', voidedAt: new Date(), voidedBy: context.userId }).where(eq(receipts.id, input.receiptId))
    await insertAudit(tx, context, { action: 'receipt.voided', entityType: 'receipt', entityId: input.receiptId, details: { receiptNumber: receipt.number } })
  })
  revalidatePath('/')
}

export async function cancelInvoice(input: { invoiceId: string }) {
  const context = await requireBusinessPermission('invoice.cancel')
  await db.transaction(async (tx) => {
    const [invoice] = await tx.select({ id: invoices.id, status: invoices.status, amountPaid: invoices.amountPaid, total: invoices.total, businessId: invoices.businessId }).from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.businessId, context.businessId))).limit(1).for('update')
    if (!invoice) throw new Error('Invoice not found.')
    if (invoice.status === 'cancelled') throw new Error('Invoice is already cancelled.')
    if (money(invoice.amountPaid) > 0) throw new Error('Cannot cancel an invoice that has received payments. Refund the payments first.')
    await tx.update(invoices).set({ status: 'cancelled' }).where(eq(invoices.id, input.invoiceId))
    await insertAudit(tx, context, { action: 'invoice.cancelled', entityType: 'invoice', entityId: input.invoiceId })
  })
  revalidatePath('/')
}

export async function updateBusiness(input: {
  name?: string; legalName?: string; registrationNumber?: string;
  taxIdentificationNumber?: string; email?: string; phone?: string;
  address?: string; city?: string; country?: string; currency?: string;
  timezone?: string; website?: string; receiptPrefix?: string;
  invoicePrefix?: string; footerText?: string;
  paymentInstructions?: string; taxDisplaySettings?: Record<string, unknown>;
}) {
  const context = await requireBusinessPermission('business.settings')
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (name.length < 2 || name.length > 160) throw new Error('Business name must be between 2 and 160 characters.')
    updates.name = name
  }
  if (input.legalName !== undefined) updates.legalName = input.legalName.trim() || null
  if (input.registrationNumber !== undefined) updates.registrationNumber = input.registrationNumber.trim() || null
  if (input.taxIdentificationNumber !== undefined) updates.taxIdentificationNumber = input.taxIdentificationNumber.trim() || null
  if (input.email !== undefined) {
    const email = input.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
    updates.email = email || null
  }
  if (input.phone !== undefined) updates.phone = input.phone.trim() || null
  if (input.address !== undefined) updates.address = input.address.trim() || null
  if (input.city !== undefined) updates.city = input.city.trim() || null
  if (input.country !== undefined) updates.country = input.country.trim() || 'Uganda'
  if (input.currency !== undefined) updates.currency = input.currency.trim() || 'UGX'
  if (input.timezone !== undefined) updates.timezone = input.timezone.trim() || 'Africa/Kampala'
  if (input.website !== undefined) updates.website = input.website.trim() || null
  if (input.receiptPrefix !== undefined) {
    const prefix = input.receiptPrefix.trim()
    if (prefix.length < 1 || prefix.length > 10) throw new Error('Receipt prefix must be 1-10 characters.')
    updates.receiptPrefix = prefix
  }
  if (input.invoicePrefix !== undefined) {
    const prefix = input.invoicePrefix.trim()
    if (prefix.length < 1 || prefix.length > 10) throw new Error('Invoice prefix must be 1-10 characters.')
    updates.invoicePrefix = prefix
  }
  if (input.footerText !== undefined) updates.footerText = input.footerText.trim() || null
  if (input.paymentInstructions !== undefined) updates.paymentInstructions = input.paymentInstructions.trim() || null
  if (input.taxDisplaySettings !== undefined) updates.taxDisplaySettings = input.taxDisplaySettings

  await db.transaction(async (tx) => {
    await tx.update(businesses).set(updates).where(eq(businesses.id, context.businessId))
    await insertAudit(tx, context, { action: 'business.updated', entityType: 'business', entityId: context.businessId, details: updates })
  })
  revalidatePath('/')
  return { id: context.businessId }
}

export async function verifyReceipt(input: { token: string }) {
  const [receipt] = await db.select({
    id: receipts.id,
    number: receipts.number,
    status: receipts.status,
    issuedAt: receipts.issuedAt,
    voidedAt: receipts.voidedAt,
    businessId: receipts.businessId,
    amount: payments.amount,
    method: payments.method,
    reference: payments.reference,
    paidAt: payments.paidAt,
    customerName: customers.name,
    businessName: businesses.name,
  })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .innerJoin(customers, eq(payments.customerId, customers.id))
    .innerJoin(businesses, eq(receipts.businessId, businesses.id))
    .where(eq(receipts.verificationToken, input.token))
    .limit(1)

  if (!receipt) return { valid: false }

  return {
    valid: true,
    number: receipt.number,
    status: receipt.status,
    issuedAt: receipt.issuedAt,
    voidedAt: receipt.voidedAt,
    amount: receipt.amount,
    currency: 'UGX',
    method: receipt.method,
    reference: receipt.reference,
    paidAt: receipt.paidAt,
    customerName: receipt.customerName,
    businessName: receipt.businessName,
  }
}

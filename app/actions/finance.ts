'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLogs, catalogueItems, customers, expenses, invoiceItems, invoices, paymentAllocations, payments, receipts } from '@/lib/db/schema'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Please sign in to continue.')
  return session.user.id
}

function money(value: string) {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) throw new Error('Enter a valid amount with up to two decimal places.')
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}


export async function getDashboardData() {
  const userId = await requireUser()
  const [customersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(customers).where(eq(customers.userId, userId))
  const [summary] = await db.select({
    invoiced: sql<string>`coalesce(sum(case when ${invoices.status} not in ('draft','cancelled') then ${invoices.total} else 0 end),0)`,
    received: sql<string>`coalesce(sum(${invoices.amountPaid}),0)`,
    outstanding: sql<string>`coalesce(sum(case when ${invoices.status} not in ('draft','cancelled') then ${invoices.total} - ${invoices.amountPaid} else 0 end),0)`,
    overdue: sql<number>`count(*) filter (where ${invoices.status} in ('issued','partially_paid','overdue') and ${invoices.dueDate} < current_date and ${invoices.amountPaid} < ${invoices.total})::int`,
  }).from(invoices).where(eq(invoices.userId, userId))
  const trend = await db.select({ month: sql<string>`to_char(date_trunc('month', ${payments.paidAt}::date), 'Mon')`, amount: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.userId, userId), sql`${payments.paidAt}::date >= date_trunc('month', current_date) - interval '5 months'`)).groupBy(sql`date_trunc('month', ${payments.paidAt}::date)`).orderBy(sql`date_trunc('month', ${payments.paidAt}::date)`)
  const recentInvoices = await db.select({ id: invoices.id, number: invoices.number, total: invoices.total, amountPaid: invoices.amountPaid, status: sql<string>`case when ${invoices.status} in ('issued','partially_paid','overdue') and ${invoices.dueDate} < current_date and ${invoices.amountPaid} < ${invoices.total} then 'overdue' else ${invoices.status} end`, issueDate: invoices.issueDate, dueDate: invoices.dueDate, customer: customers.name }).from(invoices).innerJoin(customers, and(eq(invoices.customerId, customers.id), eq(customers.userId, userId))).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt)).limit(50)
  const recentCustomers = await db.select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone, createdAt: customers.createdAt }).from(customers).where(eq(customers.userId, userId)).orderBy(desc(customers.createdAt)).limit(100)
  const recentReceipts = await db.select({ id: receipts.id, number: receipts.number, amount: payments.amount, method: payments.method, paidAt: payments.paidAt, reference: payments.reference, customer: customers.name }).from(receipts).innerJoin(payments, and(eq(receipts.paymentId, payments.id), eq(payments.userId, userId))).innerJoin(customers, and(eq(payments.customerId, customers.id), eq(customers.userId, userId))).where(eq(receipts.userId, userId)).orderBy(desc(receipts.issuedAt)).limit(100)
  const recentExpenses = await db.select({ id: expenses.id, category: expenses.category, payee: expenses.payee, description: expenses.description, method: expenses.method, paidAt: expenses.paidAt, amount: expenses.amount }).from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.paidAt)).limit(100)
  const catalogue = await db.select({ id: catalogueItems.id, name: catalogueItems.name, description: catalogueItems.description, unitPrice: catalogueItems.unitPrice, status: catalogueItems.status }).from(catalogueItems).where(eq(catalogueItems.userId, userId)).orderBy(desc(catalogueItems.createdAt)).limit(500)
  const auditTrail = await db.select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, details: auditLogs.details, createdAt: auditLogs.createdAt }).from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(100)
  return { customerCount: customersCount.count, summary, trend, invoices: recentInvoices, customers: recentCustomers, receipts: recentReceipts, expenses: recentExpenses, catalogue, auditTrail }
}

export async function getFinancialReport(days: '30' | '90' | '365' | 'all') {
  const userId = await requireUser()
  if (!['30', '90', '365', 'all'].includes(days)) throw new Error('Choose a supported reporting period.')
  const start = new Date()
  if (days !== 'all') start.setUTCDate(start.getUTCDate() - Number(days))
  const startDate = start.toISOString().slice(0, 10)
  const invoiceScope = days === 'all' ? eq(invoices.userId, userId) : and(eq(invoices.userId, userId), gte(invoices.issueDate, startDate))
  const paymentScope = days === 'all' ? and(eq(payments.userId, userId), eq(payments.status, 'confirmed')) : and(eq(payments.userId, userId), eq(payments.status, 'confirmed'), gte(payments.paidAt, startDate))
  const expenseScope = days === 'all' ? eq(expenses.userId, userId) : and(eq(expenses.userId, userId), gte(expenses.paidAt, startDate))
  const [invoiceSummary] = await db.select({ invoiced: sql<string>`coalesce(sum(case when ${invoices.status} not in ('draft','cancelled') then ${invoices.total} else 0 end),0)`, outstanding: sql<string>`coalesce(sum(case when ${invoices.status} not in ('draft','cancelled') then ${invoices.total} - ${invoices.amountPaid} else 0 end),0)` }).from(invoices).where(invoiceScope)
  const [paymentSummary] = await db.select({ received: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(paymentScope)
  const invoiceRows = await db.select({ number: invoices.number, customer: customers.name, status: invoices.status, date: invoices.issueDate, total: invoices.total, paid: invoices.amountPaid }).from(invoices).innerJoin(customers, and(eq(invoices.customerId, customers.id), eq(customers.userId, userId))).where(and(invoiceScope, sql`${invoices.status} not in ('draft','cancelled')`)).orderBy(desc(invoices.issueDate))
  const paymentRows = await db.select({ receipt: receipts.number, customer: customers.name, method: payments.method, reference: payments.reference, date: payments.paidAt, amount: payments.amount }).from(payments).innerJoin(customers, and(eq(payments.customerId, customers.id), eq(customers.userId, userId))).innerJoin(receipts, and(eq(receipts.paymentId, payments.id), eq(receipts.userId, userId))).where(paymentScope).orderBy(desc(payments.paidAt))
  const expenseRows = await db.select({ category: expenses.category, payee: expenses.payee, method: expenses.method, date: expenses.paidAt, amount: expenses.amount }).from(expenses).where(expenseScope).orderBy(desc(expenses.paidAt))
  return { startDate: days === 'all' ? null : startDate, invoiced: invoiceSummary.invoiced, outstanding: invoiceSummary.outstanding, received: paymentSummary.received, invoices: invoiceRows, payments: paymentRows, expenses: expenseRows }
}

export async function createCustomer(input: { name: string; email: string; phone: string; address: string }) {
  const userId = await requireUser()
  const name = input.name.trim()
  const email = input.email.trim()
  if (name.length < 2 || name.length > 160) throw new Error('Customer name must be between 2 and 160 characters.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(customers).values({ id, userId, name, email: email || null, phone: input.phone.trim() || null, address: input.address.trim() || null })
    await tx.insert(auditLogs).values({ id: randomUUID(), userId, action: 'customer.created', entityType: 'customer', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

export async function createInvoice(input: { customerId: string; description: string; quantity: string; unitPrice: string; taxRate: string; dueDate: string; status: 'draft' | 'issued' }) {
  const userId = await requireUser()
  const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.userId, userId))).limit(1)
  if (!customer) throw new Error('Select a customer in your account.')
  const description = input.description.trim()
  const quantity = Number(input.quantity)
  const taxRate = Number(input.taxRate)
  if (!description || description.length > 200) throw new Error('Add a description of up to 200 characters.')
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) throw new Error('Quantity must be greater than zero.')
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('Tax rate must be between 0 and 100 percent.')
  if (!isValidDate(input.dueDate)) throw new Error('Choose a valid due date.')
  if (input.status !== 'draft' && input.status !== 'issued') throw new Error('Choose whether to save a draft or issue the invoice.')
  const unitCents = money(input.unitPrice)
  const subCents = Math.round(unitCents * quantity)
  const taxCents = Math.round(subCents * taxRate / 100)
  if (!Number.isSafeInteger(subCents + taxCents)) throw new Error('Invoice total is too large.')
  const now = new Date()
  const id = randomUUID()
  const number = `INV-${now.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`
  const format = (cents: number) => (cents / 100).toFixed(2)
  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({ id, userId, customerId: customer.id, number, status: input.status, issueDate: now.toISOString().slice(0, 10), dueDate: input.dueDate, subtotal: format(subCents), taxAmount: format(taxCents), total: format(subCents + taxCents) })
    await tx.insert(invoiceItems).values({ id: randomUUID(), invoiceId: id, description, quantity: String(quantity), unitPrice: format(unitCents), taxRate: taxRate.toFixed(4), lineTotal: format(subCents + taxCents) })
    await tx.insert(auditLogs).values({ id: randomUUID(), userId, action: input.status === 'draft' ? 'invoice.draft_created' : 'invoice.issued', entityType: 'invoice', entityId: id, details: { number } })
  })
  revalidatePath('/')
  return { id, number, status: input.status }
}

export async function issueDraftInvoice(id: string) {
  const userId = await requireUser()
  await db.transaction(async (tx) => {
    const [invoice] = await tx.select({ id: invoices.id, status: invoices.status, number: invoices.number }).from(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId))).limit(1).for('update')
    if (!invoice || invoice.status !== 'draft') throw new Error('Only a draft invoice in your account can be issued.')
    await tx.update(invoices).set({ status: 'issued', issueDate: new Date().toISOString().slice(0, 10) }).where(and(eq(invoices.id, id), eq(invoices.userId, userId), eq(invoices.status, 'draft')))
    await tx.insert(auditLogs).values({ id: randomUUID(), userId, action: 'invoice.issued', entityType: 'invoice', entityId: id, details: { number: invoice.number } })
  })
  revalidatePath('/')
}

export async function recordPayment(input: { invoiceId: string; amount: string; method: string; reference: string; paidAt: string }) {
  const userId = await requireUser()
  const amount = money(input.amount)
  if (amount <= 0) throw new Error('Payment must be greater than zero.')
  if (!['Cash', 'Bank transfer', 'Mobile Money', 'Card', 'Cheque', 'Other'].includes(input.method)) throw new Error('Choose a supported payment method.')
  const reference = input.reference.trim() || null
  if (reference && reference.length > 100) throw new Error('Payment reference must be 100 characters or fewer.')
  const paidDate = input.paidAt || new Date().toISOString().slice(0, 10)
  if (!isValidDate(paidDate)) throw new Error('Choose a valid payment date.')
  const paymentId = randomUUID()
  const receiptNumber = `RCP-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`
  await db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.userId, userId))).limit(1).for('update')
    if (!invoice || invoice.status === 'draft' || invoice.status === 'cancelled') throw new Error('The selected invoice cannot receive a payment.')
    const remaining = money(invoice.total) - money(invoice.amountPaid)
    if (amount > remaining) throw new Error('Payment exceeds the outstanding balance.')
    if (reference) {
      const [duplicate] = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.userId, userId), eq(payments.reference, reference))).limit(1)
      if (duplicate) throw new Error('This payment reference has already been recorded.')
    }
    const nextPaid = money(invoice.amountPaid) + amount
    await tx.insert(payments).values({ id: paymentId, userId, customerId: invoice.customerId, reference, method: input.method, paidAt: paidDate, amount: (amount / 100).toFixed(2) })
    await tx.insert(paymentAllocations).values({ id: randomUUID(), paymentId, invoiceId: invoice.id, amount: (amount / 100).toFixed(2) })
    await tx.insert(receipts).values({ id: randomUUID(), userId, paymentId, number: receiptNumber })
    await tx.update(invoices).set({ amountPaid: (nextPaid / 100).toFixed(2), status: nextPaid >= money(invoice.total) ? 'paid' : 'partially_paid' }).where(and(eq(invoices.id, invoice.id), eq(invoices.userId, userId)))
    await tx.insert(auditLogs).values({ id: randomUUID(), userId, action: 'payment.recorded', entityType: 'payment', entityId: paymentId, details: { invoiceId: invoice.id, receiptNumber } })
  })
  revalidatePath('/')
  return { receiptNumber }
}

export async function saveCatalogueItem(input: { id?: string; name: string; description: string; unitPrice: string }) {
  const userId = await requireUser()
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
      const [existing] = await tx.select({ id: catalogueItems.id }).from(catalogueItems).where(and(eq(catalogueItems.id, input.id), eq(catalogueItems.userId, userId))).limit(1)
      if (!existing) throw new Error('Catalogue item not found.')
      await tx.update(catalogueItems).set(values).where(and(eq(catalogueItems.id, input.id), eq(catalogueItems.userId, userId)))
    } else {
      await tx.insert(catalogueItems).values({ id, userId, ...values, status: 'active' })
    }
    await tx.insert(auditLogs).values({ id: randomUUID(), userId, action: input.id ? 'catalogue_item.updated' : 'catalogue_item.created', entityType: 'catalogue_item', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

export async function setCatalogueItemStatus(input: { id: string; status: 'active' | 'inactive' }) {
  const userId = await requireUser()
  if (input.status !== 'active' && input.status !== 'inactive') throw new Error('Choose a valid catalogue status.')
  await db.transaction(async (tx) => {
    const [item] = await tx.select({ id: catalogueItems.id }).from(catalogueItems).where(and(eq(catalogueItems.id, input.id), eq(catalogueItems.userId, userId))).limit(1)
    if (!item) throw new Error('Catalogue item not found.')
    await tx.update(catalogueItems).set({ status: input.status }).where(and(eq(catalogueItems.id, input.id), eq(catalogueItems.userId, userId)))
    await tx.insert(auditLogs).values({ id: randomUUID(), userId, action: `catalogue_item.${input.status}`, entityType: 'catalogue_item', entityId: input.id })
  })
  revalidatePath('/')
}

export async function recordExpense(input: { category: string; payee: string; description: string; method: string; paidAt: string; amount: string }) {
  const userId = await requireUser()
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
    await tx.insert(expenses).values({ id, userId, category, payee, description: input.description.trim() || null, method: input.method, paidAt: input.paidAt, amount: (amount / 100).toFixed(2) })
    await tx.insert(auditLogs).values({ id: randomUUID(), userId, action: 'expense.recorded', entityType: 'expense', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

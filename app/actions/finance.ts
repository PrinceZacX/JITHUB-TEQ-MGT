'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  auditLogs, businesses, businessMemberships, businessRoles, catalogueItems, customers,
  creditNotes, creditNoteItems, documentSequences, expenses, goodsReceipts, goodsReceiptLines,
  invoiceItems, invoices, items, paymentAllocations, payments,
  purchaseOrderLines, purchaseOrders, purchaseReturnLines, purchaseReturns,
  receipts, refunds, stockLevels, stockMovements, stockReservations,
  suppliers, taxRates, user, verification, warehouses,
  quotations, quotationItems, salesOrders, salesOrderItems,
  costingLayers, valuationGroups,
} from '@/lib/db/schema'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import {
  requirePermission, defaultRole, type BusinessRole, type BusinessPermission,
} from '@/lib/permissions'
import { loadEnv } from '@/lib/env'
import { sendInvoiceEmail, sendReceiptEmail } from '@/lib/email'

const moneyPattern = /^\d{1,12}(\.\d{1,2})?$/

export async function requireUser(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Please sign in to continue.')
  return session.user.id
}

async function getUserContext(userId: string) {
  const [userRow] = await db
    .select({ id: user.id, email: user.email, platformOwner: user.platformOwner, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  if (!userRow) throw new Error('User not found.')
  return userRow
}

async function requirePlatformOwner() {
  const userId = await requireUser()
  const userRow = await getUserContext(userId)
  if (!userRow.platformOwner) throw new Error('Platform owner access required.')
  if (!userRow.emailVerified) throw new Error('Email verification is required for platform access.')
  return { userId, email: userRow.email, isPlatformOwner: true }
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

function safeDate(value: Date | string | null): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toISOString().slice(0, 10)
}

export async function requireBusiness(businessId?: string) {
  loadEnv()
  const userId = await requireUser()

  // Platform owner: can access platform administration without a business.
  // With a businessId, they explicitly select a business to operate in.
  // Otherwise, auto-resolve from their active membership (if any) so the
  // workspace dashboard works out of the box.
  const userRow = await getUserContext(userId)
  if (userRow.platformOwner) {
    if (!userRow.emailVerified) throw new Error('Email verification is required for platform access.')
    if (businessId) {
      const [business] = await db
        .select({ id: businesses.id, status: businesses.status })
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1)
      if (!business) throw new Error('Business not found.')
      if (business.status !== 'active') throw new Error('Business is not active.')
      return {
        userId, businessId,
        role: 'platform_owner', isPlatformOwner: true,
      }
    }
    // Auto-resolve from active membership
    const [membership] = await db
      .select({ businessId: businessMemberships.businessId })
      .from(businessMemberships)
      .innerJoin(businesses, eq(businesses.id, businessMemberships.businessId))
      .where(and(
        eq(businessMemberships.userId, userId),
        eq(businessMemberships.status, 'active'),
        eq(businesses.status, 'active'),
        sql`${businessMemberships.deletedAt} IS NULL`,
      ))
      .limit(1)
    if (membership) {
      return {
        userId, businessId: membership.businessId,
        role: 'platform_owner', isPlatformOwner: true,
      }
    }
    return {
      userId, businessId: null,
      role: 'platform_owner', isPlatformOwner: true,
    }
  }

  // Non-platform-owner users require a business context.
  // When no businessId is provided, resolve from their active membership.
  const targetBusinessId = businessId || null
  const whereClauses = [
    eq(businessMemberships.userId, userId),
    eq(businesses.status, 'active'),
    eq(businessMemberships.status, 'active'),
    sql`${businessMemberships.deletedAt} IS NULL`,
  ]
  if (targetBusinessId) whereClauses.push(eq(businessMemberships.businessId, targetBusinessId))

  const [membership] = await db
    .select({
      id: businessMemberships.id, businessId: businessMemberships.businessId,
      userId: businessMemberships.userId, role: businessMemberships.role,
      businessStatus: businesses.status,
    })
    .from(businessMemberships)
    .innerJoin(businesses, eq(businesses.id, businessMemberships.businessId))
    .where(and(...whereClauses))
    .limit(1)
  if (!membership) {
    if (targetBusinessId) throw new Error('You are not a member of this business.')
    throw new Error('You are not a member of an active business.')
  }
  return {
    userId, businessId: membership.businessId,
    role: membership.role as 'owner' | 'administrator' | 'finance_manager' | 'accountant' | 'sales_officer' | 'cashier' | 'viewer',
  }
}

export async function requireBusinessPermission(permission: string, businessId?: string): Promise<{
  userId: string; businessId: string; role: BusinessRole | 'platform_owner'; isPlatformOwner: boolean
}> {
  const context = await requireBusiness(businessId)
  if (context.role === 'platform_owner') {
    if (!context.businessId) {
      throw new Error('Please select a business before performing business-scoped operations.')
    }
    // Platform owners operating in a business context have full business-level
    // access (equivalent to 'owner') for that business.
    requirePermission('owner', permission as BusinessPermission)
    return { userId: context.userId, businessId: context.businessId!, role: 'platform_owner', isPlatformOwner: true }
  }
  requirePermission(context.role as BusinessRole, permission as any)
  return { userId: context.userId, businessId: context.businessId!, role: context.role as BusinessRole, isPlatformOwner: false }
}

export async function insertAudit(tx: any, context: { userId: string; businessId: string | null }, input: {
  action: string; entityType: string; entityId: string; details?: Record<string, unknown> }) {
  await tx.insert(auditLogs).values({
    id: randomUUID(), businessId: context.businessId, userId: context.userId,
    action: input.action, entityType: input.entityType, entityId: input.entityId,
    details: input.details ?? {},
  })
}

export async function allocateDocumentNumber(tx: any, businessId: string, documentType: 'invoice' | 'receipt' | 'purchase_order' | 'quotation' | 'sales_order' | 'service_ticket') {
  const now = new Date()
  const year = now.getFullYear()
  const [row] = await tx
    .select().from(documentSequences)
    .where(and(eq(documentSequences.businessId, businessId), eq(documentSequences.documentType, documentType)))
    .for('update').limit(1)
  const [business] = await tx.select({ invoicePrefix: businesses.invoicePrefix, receiptPrefix: businesses.receiptPrefix, quotationPrefix: businesses.quotationPrefix, salesOrderPrefix: businesses.salesOrderPrefix }).from(businesses).where(eq(businesses.id, businessId)).limit(1)
  if (!business) throw new Error('Business not found.')
  let prefix: string
  if (documentType === 'invoice') prefix = business.invoicePrefix
  else if (documentType === 'receipt') prefix = business.receiptPrefix
  else if (documentType === 'quotation') prefix = business.quotationPrefix || 'QUO'
  else if (documentType === 'sales_order') prefix = business.salesOrderPrefix || 'SO'
  else prefix = 'PO'
  const next = Number(row?.lastNumber ?? 0) + 1
  const padded = String(next).padStart(6, '0')
  const number = `${prefix}-${year}-${padded}`
  if (row) {
    await tx.update(documentSequences).set({ lastNumber: String(next), updatedAt: now }).where(eq(documentSequences.id, row.id))
  } else {
    await tx.insert(documentSequences).values({ id: randomUUID(), businessId, documentType, lastNumber: String(next), updatedAt: now })
  }
  return number
}

/* ------------------------------------------------------------------ */
/* Business management                                                */
/* ------------------------------------------------------------------ */

export async function createBusiness(input: {
  name: string; legalName?: string; registrationNumber?: string;
  taxIdentificationNumber?: string; email?: string; phone?: string;
  address?: string; city?: string; country?: string; currency?: string;
  timezone?: string; website?: string; receiptPrefix?: string;
  invoicePrefix?: string; footerText?: string;
  paymentInstructions?: string; taxDisplaySettings?: Record<string, unknown>;
}) {
  const userId = await requireUser()
  loadEnv()
  const name = input.name.trim()
  if (name.length < 2 || name.length > 160) throw new Error('Business name must be between 2 and 160 characters.')
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a valid email address.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(businesses).values({
      id, name, legalName: input.legalName?.trim() || null,
      registrationNumber: input.registrationNumber?.trim() || null,
      taxIdentificationNumber: input.taxIdentificationNumber?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country?.trim() || 'Uganda',
      currency: input.currency?.trim() || 'UGX',
      timezone: input.timezone?.trim() || 'Africa/Kampala',
      website: input.website?.trim() || null,
      receiptPrefix: input.receiptPrefix?.trim() || 'RCP',
      invoicePrefix: input.invoicePrefix?.trim() || 'INV',
      footerText: input.footerText?.trim() || null,
      paymentInstructions: input.paymentInstructions?.trim() || null,
      taxDisplaySettings: input.taxDisplaySettings ?? {},
      status: 'active',
    })
    await tx.insert(businessMemberships).values({
      id: randomUUID(), businessId: id, userId, role: 'owner',
    })
    await tx.insert(auditLogs).values({
      id: randomUUID(), businessId: id, userId,
      action: 'business.created', entityType: 'business', entityId: id, details: { name },
    })
  })
  revalidatePath('/')
  return { id }
}

export async function listBusinesses() {
  const userId = await requireUser()
  loadEnv()
  const rows = await db
    .select({
      id: businesses.id, name: businesses.name, legalName: businesses.legalName,
      email: businesses.email, phone: businesses.phone,
      city: businesses.city, country: businesses.country,
      currency: businesses.currency, status: businesses.status,
      createdAt: businesses.createdAt,
    })
    .from(businesses)
    .innerJoin(businessMemberships, eq(businessMemberships.businessId, businesses.id))
    .where(eq(businessMemberships.userId, userId))
    .orderBy(desc(businesses.createdAt))
  return rows
}

export async function setActiveBusiness(input: { businessId: string }) {
  const userId = await requireUser()
  loadEnv()
  const [membership] = await db
    .select({ id: businessMemberships.id, role: businessMemberships.role, deletedAt: businessMemberships.deletedAt })
    .from(businessMemberships)
    .where(and(
      eq(businessMemberships.businessId, input.businessId),
      eq(businessMemberships.userId, userId),
    ))
    .limit(1)
  if (!membership) throw new Error('You are not a member of this business.')
  if (membership.deletedAt) throw new Error('Membership has been removed. Contact the business owner.')
  const [business] = await db.select({ status: businesses.status }).from(businesses).where(eq(businesses.id, input.businessId)).limit(1)
  if (!business || business.status !== 'active') throw new Error('Business is not active.')
  await db.transaction(async (tx) => {
    if (membership.deletedAt) {
      await tx.update(businessMemberships).set({ deletedAt: null, deletedBy: null, status: 'active' }).where(eq(businessMemberships.id, membership.id))
    }
    await insertAudit(tx, { userId, businessId: input.businessId }, { action: 'business.switched', entityType: 'business', entityId: input.businessId })
  })
  revalidatePath('/')
  return { success: true }
}

/* ------------------------------------------------------------------ */
/* Business memberships                                               */
/* ------------------------------------------------------------------ */

export async function listBusinessMembers(input: { businessId: string }) {
  const context = await requireBusinessPermission('membership.manage', input.businessId)
  const rows = await db
    .select({
      id: businessMemberships.id, userId: businessMemberships.userId,
      role: businessMemberships.role, status: businessMemberships.status,
      deletedAt: businessMemberships.deletedAt,
      userName: user.name, userEmail: user.email,
    })
    .from(businessMemberships)
    .innerJoin(user, eq(user.id, businessMemberships.userId))
    .where(and(
      eq(businessMemberships.businessId, input.businessId),
      sql`${businessMemberships.deletedAt} IS NULL`,
    ))
    .orderBy(desc(businessMemberships.createdAt))
  return rows
}

export async function inviteMember(input: { businessId: string; email: string; role: BusinessRole }) {
  const context = await requireBusinessPermission('membership.manage', input.businessId)
  const email = input.email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  if (!businessRoles.includes(input.role)) throw new Error('Choose a valid role.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(businessMemberships).values({
      id, businessId: context.businessId, userId: '', role: input.role,
    })
    await insertAudit(tx, context, { action: 'membership.invited', entityType: 'business_membership', entityId: id, details: { email, role: input.role } })
  })
  revalidatePath('/')
  return { id }
}

export async function updateMembershipRole(input: { businessId: string; userId: string; role: BusinessRole }) {
  const context = await requireBusinessPermission('membership.manage', input.businessId)
  if (!businessRoles.includes(input.role)) throw new Error('Choose a valid role.')
  const [existing] = await db.select({ id: businessMemberships.id, role: businessMemberships.role, status: businessMemberships.status }).from(businessMemberships).where(and(
    eq(businessMemberships.businessId, input.businessId),
    eq(businessMemberships.userId, input.userId),
    sql`${businessMemberships.deletedAt} IS NULL`,
  )).limit(1)
  if (!existing) throw new Error('Membership not found.')
  if (existing.status === 'removed') throw new Error('Cannot update a removed membership.')
  if (existing.role === 'owner') throw new Error('Cannot change the business owner role.')
  await db.transaction(async (tx) => {
    await tx.update(businessMemberships).set({ role: input.role }).where(and(
      eq(businessMemberships.businessId, input.businessId),
      eq(businessMemberships.userId, input.userId),
    ))
    await insertAudit(tx, context, { action: 'membership.role_updated', entityType: 'business_membership', entityId: input.userId, details: { previousRole: existing.role, newRole: input.role } })
  })
  revalidatePath('/')
  return { success: true }
}

export async function suspendMembership(input: { businessId: string; userId: string }) {
  const context = await requireBusinessPermission('membership.manage', input.businessId)
  const [existing] = await db.select({ role: businessMemberships.role, status: businessMemberships.status }).from(businessMemberships).where(and(
    eq(businessMemberships.businessId, input.businessId),
    eq(businessMemberships.userId, input.userId),
    sql`${businessMemberships.deletedAt} IS NULL`,
  )).limit(1)
  if (!existing) throw new Error('Membership not found.')
  if (existing.role === 'owner') throw new Error('Cannot suspend the business owner.')
  if (existing.status === 'removed') throw new Error('Membership is already removed.')
  await db.transaction(async (tx) => {
    await tx.update(businessMemberships).set({ status: 'suspended', role: 'viewer' }).where(and(
      eq(businessMemberships.businessId, input.businessId),
      eq(businessMemberships.userId, input.userId),
    ))
    await insertAudit(tx, context, { action: 'membership.suspended', entityType: 'business_membership', entityId: input.userId })
  })
  revalidatePath('/')
  return { success: true }
}

export async function removeMembership(input: { businessId: string; userId: string }) {
  const context = await requireBusinessPermission('membership.manage', input.businessId)
  const [existing] = await db.select({ role: businessMemberships.role, status: businessMemberships.status, deletedAt: businessMemberships.deletedAt }).from(businessMemberships).where(and(
    eq(businessMemberships.businessId, input.businessId),
    eq(businessMemberships.userId, input.userId),
  )).limit(1)
  if (!existing) throw new Error('Membership not found.')
  if (existing.role === 'owner') throw new Error('Cannot remove the business owner.')
  if (existing.status === 'removed' || existing.deletedAt) throw new Error('Membership is already removed.')
  await db.transaction(async (tx) => {
    await tx.update(businessMemberships).set({ status: 'removed', deletedAt: new Date(), deletedBy: context.userId }).where(and(
      eq(businessMemberships.businessId, input.businessId),
      eq(businessMemberships.userId, input.userId),
    ))
    await insertAudit(tx, context, { action: 'membership.removed', entityType: 'business_membership', entityId: input.userId })
  })
  revalidatePath('/')
  return { success: true }
}

/* ------------------------------------------------------------------ */
/* Customers                                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Expenses                                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Refunds                                                            */
/* ------------------------------------------------------------------ */

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
    await tx.insert(refunds).values({ id: refundId, businessId: context.businessId, paymentId: payment.id, requestedBy: context.userId, amount: (amount / 100).toFixed(2), reason: input.reason.trim(), method, reference, status: 'pending', idempotencyKey })
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

/* ------------------------------------------------------------------ */
/* Receipts & Invoices                                                */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Business settings                                                  */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Invoices                                                           */
/* ------------------------------------------------------------------ */

export async function createInvoice(input: {
  customerId: string
  title?: string
  dueDate: string
  status: 'draft' | 'issued'
  taxTreatment?: 'standard' | 'zero_rated' | 'exempt' | 'outside_scope'
  taxInclusive?: boolean
  poReference?: string
  paymentTerms?: string
  notes?: string
  termsAndConditions?: string
  discountAmount?: string
  discountType?: 'percentage' | 'fixed'
  otherCharges?: string
  lines: { description: string; quantity: string; unitPrice: string; taxType: 'standard' | 'zero_rated' | 'exempt' | 'outside_scope'; taxRate: string; discountPercentage?: string; discountAmount?: string }[]
}) {
  const context = await requireBusinessPermission(input.status === 'issued' ? 'invoice.issue' : 'invoice.create')
  const [customer] = await db.select({ id: customers.id, businessId: customers.businessId }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.businessId, context.businessId))).limit(1)
  if (!customer) throw new Error('Select a customer in your account.')
  if (!input.lines || input.lines.length === 0) throw new Error('Add at least one invoice item.')
  if (!isValidDate(input.dueDate)) throw new Error('Choose a valid due date.')
  if (input.status !== 'draft' && input.status !== 'issued') throw new Error('Choose whether to save a draft or issue the invoice.')

  const invoiceId = randomUUID()
  const number = await allocateDocumentNumber(db as any, context.businessId, 'invoice')
  const format = (cents: number) => (cents / 100).toFixed(2)

  // Calculate totals for all lines
  let totalSubtotalCents = 0
  let totalTaxCents = 0
  const lineItems: { id: string; description: string; quantity: string; unitPrice: string; taxType: string; taxRate: string; discountPercentage: string; discountAmount: string; lineTotal: string; sortOrder: number }[] = []

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]
    const description = line.description.trim()
    if (!description || description.length > 200) throw new Error('Add a description of up to 200 characters.')
    const quantityMilli = scaledDecimal(line.quantity, 3, 'Quantity')
    const quantity = Number(quantityMilli) / 1000
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) throw new Error('Quantity must be greater than zero.')
    const unitCents = money(line.unitPrice)
    const taxRate = Number(line.taxRate) || 0
    if (taxRate < 0 || taxRate > 100) throw new Error('Tax rate must be between 0 and 100 percent.')

    // Apply discount
    const discountPct = Number(line.discountPercentage) || 0
    const discountAmt = line.discountAmount ? money(line.discountAmount) : 0
    const lineSubtotalCents = Number((BigInt(unitCents) * quantityMilli + 500n) / 1000n)
    const discountFromPct = Number((BigInt(lineSubtotalCents) * BigInt(Math.round(discountPct * 100)) + 5000n) / 10000n)
    const totalDiscountCents = discountFromPct + discountAmt
    const netLineSubtotalCents = lineSubtotalCents - totalDiscountCents

    // Calculate tax based on tax type
    let lineTaxCents = 0
    const taxType = line.taxType || input.taxTreatment || 'standard'
    if (taxType === 'standard') {
      const taxRateBasisPoints = BigInt(Math.round(taxRate * 100))
      lineTaxCents = Number((BigInt(netLineSubtotalCents) * taxRateBasisPoints + 500_000n) / 1_000_000n)
    }
    // zero_rated, exempt, outside_scope: no tax

    const lineTotalCents = netLineSubtotalCents + lineTaxCents
    if (!Number.isSafeInteger(lineTotalCents)) throw new Error('Line total is too large.')

    totalSubtotalCents += netLineSubtotalCents
    totalTaxCents += lineTaxCents

    lineItems.push({
      id: randomUUID(),
      description,
      quantity: (Number(quantityMilli) / 1000).toFixed(3),
      unitPrice: format(unitCents),
      taxType,
      taxRate: taxRate.toFixed(4),
      discountPercentage: discountPct.toFixed(4),
      discountAmount: format(discountAmt),
      lineTotal: format(lineTotalCents),
      sortOrder: i,
    })
  }

  // Apply invoice-level discount
  const invoiceDiscountCents = input.discountAmount ? money(input.discountAmount) : 0
  const invoiceDiscountType = input.discountType || 'percentage'
  let invoiceDiscountTotalCents = 0
  if (invoiceDiscountType === 'percentage') {
    invoiceDiscountTotalCents = Number((BigInt(totalSubtotalCents) * BigInt(Math.round(Number(input.discountAmount || '0') * 100)) + 5000n) / 10000n)
  } else {
    invoiceDiscountTotalCents = invoiceDiscountCents
  }
  const netSubtotalCents = totalSubtotalCents - invoiceDiscountTotalCents

  // Apply other charges
  const otherChargesCents = input.otherCharges ? money(input.otherCharges) : 0
  const finalSubtotalCents = netSubtotalCents + otherChargesCents

  // Calculate total tax (proportional to subtotal)
  const totalTaxCentsFinal = totalTaxCents

  const grandTotalCents = finalSubtotalCents + totalTaxCentsFinal
  if (!Number.isSafeInteger(grandTotalCents)) throw new Error('Invoice total is too large.')

  // Determine tax treatment
  const taxTreatment = input.taxTreatment || 'standard'

  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id: invoiceId,
      businessId: context.businessId,
      userId: context.userId,
      customerId: customer.id,
      number,
      title: input.title?.trim() || null,
      status: input.status,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: input.dueDate,
      currency: 'UGX',
      taxTreatment,
      taxInclusive: input.taxInclusive || false,
      poReference: input.poReference?.trim() || null,
      paymentTerms: input.paymentTerms?.trim() || null,
      notes: input.notes?.trim() || null,
      termsAndConditions: input.termsAndConditions?.trim() || null,
      discountAmount: format(invoiceDiscountTotalCents),
      discountType: invoiceDiscountType,
      otherCharges: format(otherChargesCents),
      subtotal: format(finalSubtotalCents),
      taxAmount: format(totalTaxCentsFinal),
      total: format(grandTotalCents),
      amountPaid: '0.00',
      creditedAmount: '0.00',
    })

    for (const item of lineItems) {
      await tx.insert(invoiceItems).values({
        id: item.id,
        businessId: context.businessId,
        invoiceId: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxType: item.taxType,
        taxRate: item.taxRate,
        discountPercentage: item.discountPercentage,
        discountAmount: item.discountAmount,
        lineTotal: item.lineTotal,
        sortOrder: item.sortOrder,
      })
    }

    await insertAudit(tx, context, { action: input.status === 'draft' ? 'invoice.draft_created' : 'invoice.issued', entityType: 'invoice', entityId: invoiceId, details: { number } })
  })

  revalidatePath('/')
  return { id: invoiceId, number, status: input.status }
}

export async function issueDraftInvoice(id: string) {
  const context = await requireBusinessPermission('invoice.issue')
  let customerId = ''
  let currency = ''
  let total = ''
  let dueDate = ''
  let number = ''
  await db.transaction(async (tx) => {
    const [invoice] = await tx.select({ id: invoices.id, status: invoices.status, number: invoices.number, businessId: invoices.businessId, customerId: invoices.customerId, currency: invoices.currency, total: invoices.total, dueDate: invoices.dueDate }).from(invoices).where(and(eq(invoices.id, id), eq(invoices.businessId, context.businessId))).limit(1).for('update')
    if (!invoice || invoice.status !== 'draft') throw new Error('Only a draft invoice in your business can be issued.')
    customerId = invoice.customerId
    currency = invoice.currency
    total = invoice.total
    dueDate = invoice.dueDate
    number = invoice.number
    await tx.update(invoices).set({ status: 'issued', issueDate: new Date().toISOString().slice(0, 10) }).where(and(eq(invoices.id, id), eq(invoices.businessId, context.businessId), eq(invoices.status, 'draft')))
    await insertAudit(tx, context, { action: 'invoice.issued', entityType: 'invoice', entityId: id, details: { number } })
  })
  try {
    const [customer] = await db.select({ email: customers.email, name: customers.name }).from(customers).where(eq(customers.id, customerId)).limit(1)
    if (customer?.email) {
      await sendInvoiceEmail({ to: customer.email, invoiceNumber: number, amount: total, currency, dueDate: safeDate(dueDate), pdfUrl: `${process.env.BETTER_AUTH_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ''}/api/documents/invoice/${id}` })
    }
  } catch { }
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
  let customerId = ''
  let currency = ''
  await db.transaction(async (tx) => {
    if (idempotencyKey) {
      const [existing] = await tx.select({ id: payments.id, amount: payments.amount }).from(payments).where(and(eq(payments.businessId, context.businessId), eq(payments.idempotencyKey, idempotencyKey))).limit(1)
      if (existing) throw new Error('A payment with this request key has already been recorded.')
    }
    const [invoice] = await tx.select({ id: invoices.id, status: invoices.status, total: invoices.total, amountPaid: invoices.amountPaid, customerId: invoices.customerId, currency: invoices.currency, businessId: invoices.businessId }).from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.businessId, context.businessId))).limit(1).for('update')
    if (!invoice || invoice.status === 'draft' || invoice.status === 'cancelled') throw new Error('The selected invoice cannot receive a payment.')
    const remaining = money(invoice.total) - money(invoice.amountPaid)
    if (amount > remaining) throw new Error('Payment exceeds the outstanding balance.')
    if (reference) {
      const [duplicate] = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.businessId, context.businessId), eq(payments.reference, reference))).limit(1)
      if (duplicate) throw new Error('This payment reference has already been recorded.')
    }
    const nextPaid = money(invoice.amountPaid) + amount
    const verificationToken = createHash('sha256').update(randomBytes(32).toString('hex') + receiptNumber).digest('hex')
    customerId = invoice.customerId
    currency = invoice.currency
    await tx.insert(payments).values({ id: paymentId, businessId: context.businessId, userId: context.userId, customerId: invoice.customerId, reference, idempotencyKey, method: input.method.toLowerCase().replace(' ', '_'), paidAt: paidDate, amount: (amount / 100).toFixed(2) })
    await tx.insert(paymentAllocations).values({ id: randomUUID(), businessId: context.businessId, paymentId: paymentId, invoiceId: invoice.id, amount: (amount / 100).toFixed(2) })
    await tx.insert(receipts).values({ id: randomUUID(), businessId: context.businessId, userId: context.userId, paymentId, number: receiptNumber, verificationToken })
    await tx.update(invoices).set({ amountPaid: (nextPaid / 100).toFixed(2), status: nextPaid >= money(invoice.total) ? 'paid' : 'partially_paid' }).where(and(eq(invoices.id, invoice.id), eq(invoices.businessId, context.businessId)))
    await insertAudit(tx, context, { action: 'payment.recorded', entityType: 'payment', entityId: paymentId, details: { invoiceId: invoice.id, receiptNumber, amount: (amount / 100).toFixed(2) } })
  })
  revalidatePath('/')
  try {
    const [customer] = await db.select({ email: customers.email, name: customers.name }).from(customers).where(eq(customers.id, customerId)).limit(1)
    if (customer?.email) {
      await sendReceiptEmail({ to: customer.email, receiptNumber, amount: (amount / 100).toFixed(2), currency, paidAt: paidDate, pdfUrl: `${process.env.BETTER_AUTH_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ''}/api/documents/receipt/${paymentId}` })
    }
  } catch { }
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

/* ------------------------------------------------------------------ */
/* Dashboard data                                                     */
/* ------------------------------------------------------------------ */

export async function getDashboardData() {
  const context = await requireBusinessPermission('reports.read')
  const { businessId } = context

  const [business] = await db
    .select({ id: businesses.id, name: businesses.name, legalName: businesses.legalName, registrationNumber: businesses.registrationNumber, taxIdentificationNumber: businesses.taxIdentificationNumber, email: businesses.email, phone: businesses.phone, address: businesses.address, city: businesses.city, country: businesses.country, currency: businesses.currency, receiptPrefix: businesses.receiptPrefix, invoicePrefix: businesses.invoicePrefix, logoUrl: businesses.logoUrl, website: businesses.website })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)

  const allInvoices = await db
    .select({
      id: invoices.id, number: invoices.number, status: invoices.status,
      total: invoices.total, amountPaid: invoices.amountPaid,
      issueDate: invoices.issueDate, dueDate: invoices.dueDate,
      customerName: customers.name,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(eq(invoices.businessId, businessId))
    .orderBy(desc(invoices.createdAt))

  const allCustomers = await db
    .select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone, address: customers.address, createdAt: customers.createdAt })
    .from(customers)
    .where(eq(customers.businessId, businessId))
    .orderBy(desc(customers.createdAt))

  const allReceipts = await db
    .select({
      id: receipts.id, number: receipts.number, status: receipts.status,
      amount: payments.amount, method: payments.method, paidAt: payments.paidAt,
      reference: payments.reference, customerName: customers.name,
    })
    .from(receipts)
    .innerJoin(payments, eq(payments.id, receipts.paymentId))
    .innerJoin(customers, eq(customers.id, payments.customerId))
    .where(eq(receipts.businessId, businessId))
    .orderBy(desc(receipts.issuedAt))

  const allCatalogue = await db
    .select({ id: catalogueItems.id, name: catalogueItems.name, description: catalogueItems.description, unitPrice: catalogueItems.unitPrice, status: catalogueItems.status })
    .from(catalogueItems)
    .where(eq(catalogueItems.businessId, businessId))
    .orderBy(desc(catalogueItems.createdAt))

  const allRefunds = await db
    .select({ id: refunds.id, amount: refunds.amount, reason: refunds.reason, method: refunds.method, status: refunds.status, createdAt: refunds.createdAt })
    .from(refunds)
    .where(eq(refunds.businessId, businessId))
    .orderBy(desc(refunds.createdAt))

  const allAuditTrail = await db
    .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(eq(auditLogs.businessId, businessId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50)

  const allExpenses = await db
    .select({ id: expenses.id, category: expenses.category, payee: expenses.payee, paidAt: expenses.paidAt, method: expenses.method, amount: expenses.amount })
    .from(expenses)
    .where(eq(expenses.businessId, businessId))
    .orderBy(desc(expenses.createdAt))
    .limit(50)

  const totalInvoiced = allInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)
  const totalReceived = allReceipts.reduce((sum, rcp) => sum + Number(rcp.amount), 0)
  const overdueCount = allInvoices.filter(inv => inv.status === 'overdue').length
  const outstanding = Math.max(0, totalInvoiced - totalReceived)

  const now = new Date()
  const trend = []
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = new Intl.DateTimeFormat('en', { month: 'short' }).format(date)
    const monthStart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10)
    const monthPayments = allReceipts.filter(rcp => {
      const d = String(rcp.paidAt)
      return d >= monthStart && d <= monthEnd
    })
    const monthTotal = monthPayments.reduce((sum, rcp) => sum + Number(rcp.amount), 0)
    trend.push({ month: label, amount: monthTotal })
  }

  return {
    business: business ? { id: business.id, name: business.name, legalName: business.legalName, email: business.email, phone: business.phone, address: business.address, city: business.city, country: business.country, currency: business.currency, receiptPrefix: business.receiptPrefix, invoicePrefix: business.invoicePrefix, logoUrl: business.logoUrl, website: business.website } : undefined,
    invoices: allInvoices.map(inv => ({
      id: inv.id, number: inv.number, customer: inv.customerName, status: inv.status,
      total: inv.total, amountPaid: inv.amountPaid, issueDate: inv.issueDate, dueDate: inv.dueDate,
    })),
    customers: allCustomers.map(c => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone, address: c.address, createdAt: c.createdAt,
    })),
    receipts: allReceipts.map(rcp => ({
      id: rcp.id, number: rcp.number, customer: rcp.customerName, status: rcp.status,
      amount: rcp.amount, method: rcp.method, paidAt: rcp.paidAt, reference: rcp.reference,
    })),
    catalogue: allCatalogue,
    refunds: allRefunds,
    expenses: allExpenses.map(e => ({
      id: e.id, category: e.category, payee: e.payee, paidAt: e.paidAt, method: e.method, amount: e.amount,
    })),
    auditTrail: allAuditTrail,
    summary: { invoiced: totalInvoiced, received: totalReceived, outstanding, overdue: overdueCount },
    customerCount: allCustomers.length,
    trend,
  }
}

/* ------------------------------------------------------------------ */
/* Platform Dashboard Data (no business context required)             */
/* ------------------------------------------------------------------ */

export async function getPlatformDashboardData(): Promise<{
  businesses: { id: string; name: string; city: string | null; country: string; currency: string; status: string; createdAt: Date }[]
  auditTrail: { id: string; action: string; entityType: string; entityId: string; createdAt: Date }[]
  summary: { totalBusinesses: number; totalUsers: number; totalInvoiced: number; totalReceived: number; totalOutstanding: number }
}> {
  const context = await requirePlatformOwner()
  const { userId } = context

  // All registered businesses (for business selection)
  const allBusinesses = await db
    .select({
      id: businesses.id, name: businesses.name, city: businesses.city,
      country: businesses.country, currency: businesses.currency,
      status: businesses.status, createdAt: businesses.createdAt,
    })
    .from(businesses)
    .orderBy(desc(businesses.createdAt))

  // Platform-level audit trail (all audit logs across all businesses)
  const allAuditTrail = await db
    .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100)

  // Platform-level aggregates
  const totalInvoiced = await db
    .select({ total: sql<number>`coalesce(sum(${invoices.total}), 0)` })
    .from(invoices)
  const totalReceived = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
  const totalUsers = await db
    .select({ total: sql<number>`count(*)` })
    .from(user)

  const grandTotalInvoiced = Number(totalInvoiced[0]?.total ?? 0)
  const grandTotalReceived = Number(totalReceived[0]?.total ?? 0)

  return {
    businesses: allBusinesses.map(b => ({
      id: b.id, name: b.name, city: b.city, country: b.country,
      currency: b.currency, status: b.status, createdAt: b.createdAt,
    })),
    auditTrail: allAuditTrail,
    summary: {
      totalBusinesses: allBusinesses.length,
      totalUsers: Number(totalUsers[0]?.total ?? 0),
      totalInvoiced: grandTotalInvoiced,
      totalReceived: grandTotalReceived,
      totalOutstanding: Math.max(0, grandTotalInvoiced - grandTotalReceived),
    },
  }
}

export async function getFinancialReport(period: '30' | '90' | '365' | 'all'): Promise<{
  invoiced: number
  received: number
  outstanding: number
  invoices: { number: string; customer: string; status: string; date: string; total: string; paid: string }[]
  payments: { receipt: string; customer: string; date: string; method: string; reference: string; amount: string }[]
  expenses: { category: string; payee: string; date: string; method: string; amount: string }[]
  summary: { startDate: string }
}> {
  const context = await requireBusinessPermission('reports.read')
  const { businessId } = context
  const now = new Date()
  let from: string
  if (period === 'all') {
    from = '1900-01-01'
  } else {
    const days = Number(period)
    const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
    from = fromDate.toISOString().slice(0, 10)
  }
  const to = now.toISOString().slice(0, 10)

  if (!isValidDate(from) || !isValidDate(to)) throw new Error('Choose valid date range.')

  const allInvoices = await db
    .select({
      number: invoices.number, customerName: customers.name, status: invoices.status,
      issueDate: invoices.issueDate, total: invoices.total, amountPaid: invoices.amountPaid,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(and(eq(invoices.businessId, businessId), gte(invoices.issueDate, from), lte(invoices.issueDate, to)))

  const allPayments = await db
    .select({
      amount: payments.amount, method: payments.method, paidAt: payments.paidAt,
      reference: payments.reference, customerName: customers.name,
    })
    .from(payments)
    .innerJoin(customers, eq(customers.id, payments.customerId))
    .where(and(eq(payments.businessId, businessId), gte(payments.paidAt, from), lte(payments.paidAt, to)))

  const allExpenses = await db
    .select({ category: expenses.category, payee: expenses.payee, paidAt: expenses.paidAt, method: expenses.method, amount: expenses.amount })
    .from(expenses)
    .where(and(eq(expenses.businessId, businessId), gte(expenses.paidAt, from), lte(expenses.paidAt, to)))

  const invoiced = allInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)
  const received = allPayments.reduce((sum, pmt) => sum + Number(pmt.amount), 0)
  const spent = allExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)

  return {
    invoiced,
    received,
    outstanding: Math.max(0, invoiced - received),
    invoices: allInvoices.map(inv => ({
      number: inv.number, customer: inv.customerName, status: inv.status,
      date: inv.issueDate, total: inv.total, paid: inv.amountPaid,
    })),
    payments: allPayments.map(pmt => ({
      receipt: pmt.reference || '', customer: pmt.customerName, date: pmt.paidAt,
      method: pmt.method, reference: pmt.reference || '', amount: pmt.amount,
    })),
    expenses: allExpenses.map(exp => ({
      category: exp.category, payee: exp.payee, date: exp.paidAt,
      method: exp.method, amount: exp.amount,
    })),
    summary: { startDate: from },
  }
}

/* ------------------------------------------------------------------ */
/* Suppliers                                                          */
/* ------------------------------------------------------------------ */

export async function createSupplier(input: {
  name: string; legalName?: string; registrationNumber?: string;
  taxIdentificationNumber?: string; email?: string; phone?: string;
  address?: string; city?: string; country?: string;
  category?: string; creditLimit?: string; creditTermsDays?: string;
}) {
  const context = await requireBusinessPermission('supplier.manage')
  const name = input.name.trim()
  if (name.length < 2 || name.length > 160) throw new Error('Supplier name must be between 2 and 160 characters.')
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a valid email address.')
  const creditLimit = input.creditLimit ? money(input.creditLimit) : 0
  const creditTermsDays = input.creditTermsDays ? Number(input.creditTermsDays) : 0
  if (!Number.isInteger(creditTermsDays) || creditTermsDays < 0) throw new Error('Credit terms days must be a non-negative integer.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(suppliers).values({
      id, businessId: context.businessId, name,
      legalName: input.legalName?.trim() || null,
      registrationNumber: input.registrationNumber?.trim() || null,
      taxIdentificationNumber: input.taxIdentificationNumber?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country?.trim() || 'Uganda',
      category: input.category?.trim() || null,
      creditLimit: (creditLimit / 100).toFixed(2),
      creditTermsDays: creditTermsDays.toString(),
      status: 'active',
    })
    await insertAudit(tx, context, { action: 'supplier.created', entityType: 'supplier', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

export async function listSuppliers() {
  const context = await requireBusinessPermission('supplier.manage')
  const rows = await db
    .select({
      id: suppliers.id, name: suppliers.name, legalName: suppliers.legalName,
      email: suppliers.email, phone: suppliers.phone,
      city: suppliers.city, country: suppliers.country,
      category: suppliers.category, creditLimit: suppliers.creditLimit,
      creditTermsDays: suppliers.creditTermsDays,
      status: suppliers.status, createdAt: suppliers.createdAt,
    })
    .from(suppliers)
    .where(eq(suppliers.businessId, context.businessId))
    .orderBy(desc(suppliers.createdAt))
  return rows
}

export async function updateSupplier(input: {
  id: string; name?: string; legalName?: string; registrationNumber?: string;
  taxIdentificationNumber?: string; email?: string; phone?: string;
  address?: string; city?: string; country?: string;
  category?: string; creditLimit?: string; creditTermsDays?: string;
  status?: string;
}) {
  const context = await requireBusinessPermission('supplier.manage')
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (name.length < 2 || name.length > 160) throw new Error('Supplier name must be between 2 and 160 characters.')
    updates.name = name
  }
  if (input.legalName !== undefined) updates.legalName = input.legalName.trim() || null
  if (input.registrationNumber !== undefined) updates.registrationNumber = input.registrationNumber.trim() || null
  if (input.taxIdentificationNumber !== undefined) updates.taxIdentificationNumber = input.taxIdentificationNumber.trim() || null
  if (input.email !== undefined) {
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a valid email address.')
    updates.email = input.email.trim() || null
  }
  if (input.phone !== undefined) updates.phone = input.phone.trim() || null
  if (input.address !== undefined) updates.address = input.address.trim() || null
  if (input.city !== undefined) updates.city = input.city.trim() || null
  if (input.country !== undefined) updates.country = input.country.trim() || 'Uganda'
  if (input.category !== undefined) updates.category = input.category.trim() || null
  if (input.creditLimit !== undefined) updates.creditLimit = (money(input.creditLimit) / 100).toFixed(2)
  if (input.creditTermsDays !== undefined) {
    const creditTermsDays = Number(input.creditTermsDays)
    if (!Number.isInteger(creditTermsDays) || creditTermsDays < 0) throw new Error('Credit terms days must be a non-negative integer.')
    updates.creditTermsDays = creditTermsDays.toString()
  }
  if (input.status !== undefined) {
    if (!['active', 'inactive', 'suspended'].includes(input.status)) throw new Error('Choose a valid supplier status.')
    updates.status = input.status
  }
  const [existing] = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, input.id), eq(suppliers.businessId, context.businessId))).limit(1)
  if (!existing) throw new Error('Supplier not found.')
  await db.transaction(async (tx) => {
    await tx.update(suppliers).set(updates).where(and(eq(suppliers.id, input.id), eq(suppliers.businessId, context.businessId)))
    await insertAudit(tx, context, { action: 'supplier.updated', entityType: 'supplier', entityId: input.id })
  })
  revalidatePath('/')
  return { id: input.id }
}

export async function suspendSupplier(input: { id: string }) {
  const context = await requireBusinessPermission('supplier.manage')
  const [existing] = await db.select({ id: suppliers.id, status: suppliers.status }).from(suppliers).where(and(eq(suppliers.id, input.id), eq(suppliers.businessId, context.businessId))).limit(1)
  if (!existing) throw new Error('Supplier not found.')
  if (existing.status === 'suspended') throw new Error('Supplier is already suspended.')
  await db.transaction(async (tx) => {
    await tx.update(suppliers).set({ status: 'suspended' }).where(and(eq(suppliers.id, input.id), eq(suppliers.businessId, context.businessId)))
    await insertAudit(tx, context, { action: 'supplier.suspended', entityType: 'supplier', entityId: input.id })
  })
  revalidatePath('/')
  return { success: true }
}

export async function reactivateSupplier(input: { id: string }) {
  const context = await requireBusinessPermission('supplier.manage')
  const [existing] = await db.select({ id: suppliers.id, status: suppliers.status }).from(suppliers).where(and(eq(suppliers.id, input.id), eq(suppliers.businessId, context.businessId))).limit(1)
  if (!existing) throw new Error('Supplier not found.')
  if (existing.status !== 'suspended') throw new Error('Supplier is not suspended.')
  await db.transaction(async (tx) => {
    await tx.update(suppliers).set({ status: 'active' }).where(and(eq(suppliers.id, input.id), eq(suppliers.businessId, context.businessId)))
    await insertAudit(tx, context, { action: 'supplier.reactivated', entityType: 'supplier', entityId: input.id })
  })
  revalidatePath('/')
  return { success: true }
}

/* ------------------------------------------------------------------ */
/* Purchase Orders                                                    */
/* ------------------------------------------------------------------ */

export async function createPurchaseOrder(input: {
  supplierId: string; warehouseId: string; expectedDate?: string;
  notes?: string; lines?: { itemId: string; description: string; quantity: string; unitPrice: string; taxRate?: string }[];
}) {
  const context = await requireBusinessPermission('purchase_order.create')
  const id = randomUUID()
  const number = await allocateDocumentNumber(db as any, context.businessId, 'purchase_order')
  await db.transaction(async (tx) => {
    await tx.insert(purchaseOrders).values({
      id, businessId: context.businessId, supplierId: input.supplierId,
      warehouseId: input.warehouseId, number, status: 'draft',
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDate: input.expectedDate || null,
      notes: input.notes?.trim() || null,
      createdBy: context.userId,
    })
    if (input.lines && input.lines.length > 0) {
      let subtotalCents = 0
      for (const line of input.lines) {
        const quantityMilli = scaledDecimal(line.quantity, 3, 'Quantity')
        const quantity = Number(quantityMilli) / 1000
        const unitCents = money(line.unitPrice)
        const taxRateBasisPoints = line.taxRate ? scaledDecimal(line.taxRate, 4, 'Tax rate') : 0n
        const taxRate = Number(taxRateBasisPoints) / 100
        const lineSubtotalCents = Number((BigInt(unitCents) * quantityMilli + 500n) / 1000n)
        const lineTaxCents = Number((BigInt(lineSubtotalCents) * taxRateBasisPoints + 500_000n) / 1_000_000n)
        const lineTotalCents = lineSubtotalCents + lineTaxCents
        subtotalCents += lineTotalCents
        await tx.insert(purchaseOrderLines).values({
          id: randomUUID(), businessId: context.businessId, purchaseOrderId: id,
          itemId: line.itemId, description: line.description,
          quantityOrdered: (Number(quantityMilli) / 1000).toFixed(3),
          quantityReceived: '0',
          unitPrice: (unitCents / 100).toFixed(2),
          taxRate: taxRate.toFixed(4),
          lineTotal: (lineTotalCents / 100).toFixed(2),
        })
      }
      await tx.update(purchaseOrders).set({
        subtotal: (subtotalCents / 100).toFixed(2),
        total: (subtotalCents / 100).toFixed(2),
      }).where(eq(purchaseOrders.id, id))
    }
    await insertAudit(tx, context, { action: 'purchase_order.created', entityType: 'purchase_order', entityId: id, details: { number } })
  })
  revalidatePath('/')
  return { id, number }
}

export async function listPurchaseOrders() {
  const context = await requireBusinessPermission('purchase_order.read')
  const rows = await db
    .select({
      id: purchaseOrders.id, number: purchaseOrders.number,
      supplierId: purchaseOrders.supplierId, warehouseId: purchaseOrders.warehouseId,
      status: purchaseOrders.status, orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      total: purchaseOrders.total, currency: purchaseOrders.currency,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.businessId, context.businessId))
    .orderBy(desc(purchaseOrders.createdAt))
  return rows
}

export async function approvePurchaseOrder(input: { purchaseOrderId: string }) {
  const context = await requireBusinessPermission('purchase_order.approve')
  await db.transaction(async (tx) => {
    const [po] = await tx.select({ id: purchaseOrders.id, status: purchaseOrders.status, businessId: purchaseOrders.businessId }).from(purchaseOrders).where(and(eq(purchaseOrders.id, input.purchaseOrderId), eq(purchaseOrders.businessId, context.businessId))).limit(1).for('update')
    if (!po) throw new Error('Purchase order not found.')
    if (po.status !== 'draft') throw new Error('Only draft purchase orders can be approved.')
    await tx.update(purchaseOrders).set({ status: 'submitted', updatedAt: new Date() }).where(eq(purchaseOrders.id, input.purchaseOrderId))
    await insertAudit(tx, context, { action: 'purchase_order.submitted', entityType: 'purchase_order', entityId: input.purchaseOrderId })
  })
  revalidatePath('/')
  return { success: true }
}

export async function recordPurchaseOrderPayment(input: {
  purchaseOrderId: string; amount: string; method: string; reference?: string;
}) {
  const context = await requireBusinessPermission('payment.record')
  const amount = money(input.amount)
  if (amount <= 0) throw new Error('Payment amount must be greater than zero.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    const [po] = await tx.select({ id: purchaseOrders.id, status: purchaseOrders.status, total: purchaseOrders.total, supplierId: purchaseOrders.supplierId, businessId: purchaseOrders.businessId }).from(purchaseOrders).where(and(eq(purchaseOrders.id, input.purchaseOrderId), eq(purchaseOrders.businessId, context.businessId))).limit(1).for('update')
    if (!po) throw new Error('Purchase order not found.')
    if (po.status !== 'issued' && po.status !== 'partially_paid') throw new Error('Only issued or partially paid purchase orders can receive payments.')
    const existingAlloc = await db.select({ id: paymentAllocations.id, amount: paymentAllocations.amount }).from(paymentAllocations).where(and(eq(paymentAllocations.invoiceId, input.purchaseOrderId), eq(paymentAllocations.businessId, context.businessId))).limit(1)
    const alreadyPaid = Number(existingAlloc[0]?.amount ?? '0')
    const remaining = money(po.total) - alreadyPaid
    if (amount > remaining) throw new Error('Payment exceeds outstanding balance.')
    await tx.insert(payments).values({
      id, businessId: context.businessId, userId: context.userId, customerId: po.supplierId,
      reference: null, idempotencyKey: null, method: input.method.toLowerCase().replace(' ', '_'),
      paidAt: new Date().toISOString().slice(0, 10), amount: (amount / 100).toFixed(2)
    })
    await tx.insert(paymentAllocations).values({
      id: randomUUID(), businessId: context.businessId, paymentId: id,
      invoiceId: input.purchaseOrderId, amount: (amount / 100).toFixed(2),
    })
    await tx.update(purchaseOrders).set({ status: 'paid' }).where(eq(purchaseOrders.id, input.purchaseOrderId))
    await insertAudit(tx, context, { action: 'purchase_order.payment_recorded', entityType: 'purchase_order', entityId: input.purchaseOrderId, details: { amount: (amount / 100).toFixed(2) } })
  })
  revalidatePath('/')
  return { id }
}

/* ------------------------------------------------------------------ */
/* Tax Rates                                                          */
/* ------------------------------------------------------------------ */

export async function createTaxRate(input: {
  name: string; rate: string; type?: string;
  isDefault?: boolean; isActive?: boolean;
  effectiveFrom?: string; effectiveTo?: string; description?: string;
}) {
  const context = await requireBusinessPermission('tax.manage')
  const rate = money(input.rate)
  if (!input.effectiveFrom || !isValidDate(input.effectiveFrom)) throw new Error('Choose a valid effective from date.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx.update(taxRates).set({ isDefault: false }).where(eq(taxRates.businessId, context.businessId))
    }
    await tx.insert(taxRates).values({
      id, businessId: context.businessId, name: input.name.trim(),
      rate: (rate / 100).toFixed(4),
      type: input.type || 'vat',
      isDefault: input.isDefault || false,
      isActive: input.isActive !== false,
      effectiveFrom: input.effectiveFrom!,
      effectiveTo: input.effectiveTo ?? null,
      description: input.description?.trim() || null,
    })
    await insertAudit(tx, context, { action: 'tax_rate.created', entityType: 'tax_rate', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

export async function listTaxRates() {
  const context = await requireBusinessPermission('tax.manage')
  const rows = await db
    .select({
      id: taxRates.id, name: taxRates.name, rate: taxRates.rate,
      type: taxRates.type, isDefault: taxRates.isDefault,
      isActive: taxRates.isActive,
      effectiveFrom: taxRates.effectiveFrom,
      effectiveTo: taxRates.effectiveTo,
      description: taxRates.description,
      createdAt: taxRates.createdAt,
    })
    .from(taxRates)
    .where(eq(taxRates.businessId, context.businessId))
    .orderBy(desc(taxRates.createdAt))
  return rows
}

export async function updateTaxRate(input: {
  id: string; name?: string; rate?: string; type?: string;
  isDefault?: boolean; isActive?: boolean;
  effectiveFrom?: string; effectiveTo?: string; description?: string;
}) {
  const context = await requireBusinessPermission('tax.manage')
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.rate !== undefined) updates.rate = (money(input.rate) / 100).toFixed(4)
  if (input.type !== undefined) updates.type = input.type
  if (input.isDefault !== undefined) updates.isDefault = input.isDefault
  if (input.isActive !== undefined) updates.isActive = input.isActive
  if (input.effectiveFrom !== undefined) updates.effectiveFrom = input.effectiveFrom
  if (input.effectiveTo !== undefined) updates.effectiveTo = input.effectiveTo
  if (input.description !== undefined) updates.description = input.description.trim() || null
  const [existing] = await db.select({ id: taxRates.id }).from(taxRates).where(and(eq(taxRates.id, input.id), eq(taxRates.businessId, context.businessId))).limit(1)
  if (!existing) throw new Error('Tax rate not found.')
  await db.transaction(async (tx) => {
    await tx.update(taxRates).set(updates).where(and(eq(taxRates.id, input.id), eq(taxRates.businessId, context.businessId)))
    await insertAudit(tx, context, { action: 'tax_rate.updated', entityType: 'tax_rate', entityId: input.id })
  })
  revalidatePath('/')
  return { id: input.id }
}

/* ------------------------------------------------------------------ */
/* Receipt verification (public endpoint)                             */
/* ------------------------------------------------------------------ */

export async function verifyReceipt(input: { token: string }) {
  const [receipt] = await db.select({
    id: receipts.id, number: receipts.number, status: receipts.status,
    issuedAt: receipts.issuedAt, voidedAt: receipts.voidedAt,
    amount: payments.amount, method: payments.method, reference: payments.reference,
    paidAt: payments.paidAt, customerName: customers.name, businessName: businesses.name,
  })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .innerJoin(customers, eq(payments.customerId, customers.id))
    .innerJoin(businesses, eq(receipts.businessId, businesses.id))
    .where(eq(receipts.verificationToken, input.token))
    .limit(1)

  if (!receipt) return { valid: false }

  return {
    valid: true, number: receipt.number, status: receipt.status,
    issuedAt: receipt.issuedAt, voidedAt: receipt.voidedAt,
    amount: receipt.amount, currency: 'UGX', method: receipt.method,
    reference: receipt.reference, paidAt: receipt.paidAt,
    customerName: receipt.customerName, businessName: receipt.businessName,
  }
}

/* ------------------------------------------------------------------ */
/* Warehouses                                                         */
/* ------------------------------------------------------------------ */

export async function createWarehouse(input: {
  name: string; code: string; address?: string; city?: string;
  country?: string; isDefault?: boolean;
}) {
  const context = await requireBusinessPermission('business.settings')
  const name = input.name.trim()
  const code = input.code.trim()
  if (name.length < 2 || name.length > 160) throw new Error('Warehouse name must be between 2 and 160 characters.')
  if (code.length < 1 || code.length > 20) throw new Error('Warehouse code must be between 1 and 20 characters.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx.update(warehouses).set({ isDefault: false }).where(eq(warehouses.businessId, context.businessId))
    }
    await tx.insert(warehouses).values({
      id, businessId: context.businessId, name, code,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country?.trim() || 'Uganda',
      isDefault: input.isDefault || false,
      status: 'active',
    })
    await insertAudit(tx, context, { action: 'warehouse.created', entityType: 'warehouse', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

export async function listWarehouses() {
  const context = await requireBusinessPermission('business.settings')
  const rows = await db
    .select({
      id: warehouses.id, name: warehouses.name, code: warehouses.code,
      address: warehouses.address, city: warehouses.city,
      country: warehouses.country, isDefault: warehouses.isDefault,
      status: warehouses.status, createdAt: warehouses.createdAt,
    })
    .from(warehouses)
    .where(eq(warehouses.businessId, context.businessId))
    .orderBy(desc(warehouses.createdAt))
  return rows
}

/* ------------------------------------------------------------------ */
/* Items                                                              */
/* ------------------------------------------------------------------ */

export async function createItem(input: {
  sku: string; barcode?: string; name: string; description?: string;
  category?: string; unitOfMeasure?: string; unitPrice?: string;
  costPrice?: string; taxRateId?: string; reorderLevel?: string;
  reorderQuantity?: string;
}) {
  const context = await requireBusinessPermission('catalogue.manage')
  const sku = input.sku.trim()
  const name = input.name.trim()
  if (sku.length < 1 || sku.length > 80) throw new Error('SKU must be between 1 and 80 characters.')
  if (name.length < 2 || name.length > 160) throw new Error('Item name must be between 2 and 160 characters.')
  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(items).values({
      id, businessId: context.businessId, sku, barcode: input.barcode?.trim() || null,
      name, description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      unitOfMeasure: input.unitOfMeasure || 'unit',
      unitPrice: input.unitPrice ? (money(input.unitPrice) / 100).toFixed(2) : '0.00',
      costPrice: input.costPrice ? (money(input.costPrice) / 100).toFixed(2) : '0.00',
      taxRateId: input.taxRateId || null,
      reorderLevel: input.reorderLevel ? input.reorderLevel : '0',
      reorderQuantity: input.reorderQuantity ? input.reorderQuantity : '0',
      status: 'active',
    })
    await insertAudit(tx, context, { action: 'item.created', entityType: 'item', entityId: id })
  })
  revalidatePath('/')
  return { id }
}

export async function listItems() {
  const context = await requireBusinessPermission('catalogue.manage')
  const rows = await db
    .select({
      id: items.id, sku: items.sku, barcode: items.barcode,
      name: items.name, description: items.description,
      category: items.category, unitOfMeasure: items.unitOfMeasure,
      unitPrice: items.unitPrice, costPrice: items.costPrice,
      taxRateId: items.taxRateId, status: items.status,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(eq(items.businessId, context.businessId))
    .orderBy(desc(items.createdAt))
  return rows
}

/* ------------------------------------------------------------------ */
/* Goods Receipts                                                     */
/* ------------------------------------------------------------------ */

export async function createGoodsReceipt(input: {
  purchaseOrderId: string; supplierId: string; warehouseId: string;
  receivedDate?: string; notes?: string;
}) {
  const context = await requireBusinessPermission('goods_receipt.receive')
  const id = randomUUID()
  const number = await allocateDocumentNumber(db as any, context.businessId, 'purchase_order')
  await db.transaction(async (tx) => {
    await tx.insert(goodsReceipts).values({
      id, businessId: context.businessId, purchaseOrderId: input.purchaseOrderId,
      supplierId: input.supplierId, warehouseId: input.warehouseId, number,
      receivedDate: input.receivedDate || new Date().toISOString().slice(0, 10),
      status: 'draft',
      notes: input.notes?.trim() || null,
      receivedBy: context.userId,
    })
    await insertAudit(tx, context, { action: 'goods_receipt.created', entityType: 'goods_receipt', entityId: id, details: { number } })
  })
  revalidatePath('/')
  return { id, number }
}

export async function listGoodsReceipts() {
  const context = await requireBusinessPermission('goods_receipt.receive')
  const rows = await db
    .select({
      id: goodsReceipts.id, number: goodsReceipts.number,
      purchaseOrderId: goodsReceipts.purchaseOrderId,
      supplierId: goodsReceipts.supplierId, warehouseId: goodsReceipts.warehouseId,
      status: goodsReceipts.status, receivedDate: goodsReceipts.receivedDate,
      total: goodsReceipts.total, createdAt: goodsReceipts.createdAt,
    })
    .from(goodsReceipts)
    .where(eq(goodsReceipts.businessId, context.businessId))
    .orderBy(desc(goodsReceipts.createdAt))
  return rows
}

export async function receiveGoodsReceipt(input: { goodsReceiptId: string }) {
  const context = await requireBusinessPermission('goods_receipt.receive')
  await db.transaction(async (tx) => {
    const [gr] = await tx.select({ id: goodsReceipts.id, status: goodsReceipts.status, businessId: goodsReceipts.businessId }).from(goodsReceipts).where(and(eq(goodsReceipts.id, input.goodsReceiptId), eq(goodsReceipts.businessId, context.businessId))).limit(1).for('update')
    if (!gr) throw new Error('Goods receipt not found.')
    if (gr.status !== 'draft') throw new Error('Only draft goods receipts can be received.')
    await tx.update(goodsReceipts).set({ status: 'completed', updatedAt: new Date() }).where(eq(goodsReceipts.id, input.goodsReceiptId))
    await insertAudit(tx, context, { action: 'goods_receipt.completed', entityType: 'goods_receipt', entityId: input.goodsReceiptId })
  })
  revalidatePath('/')
  return { success: true }
}

/* ------------------------------------------------------------------ */
/* Stock Movements                                                    */
/* ------------------------------------------------------------------ */

export async function listStockMovements() {
  const context = await requireBusinessPermission('stock.adjust')
  const rows = await db
    .select({
      id: stockMovements.id, itemId: stockMovements.itemId,
      warehouseId: stockMovements.warehouseId,
      movementType: stockMovements.movementType,
      quantity: stockMovements.quantity, unitCost: stockMovements.unitCost,
      referenceType: stockMovements.referenceType,
      referenceId: stockMovements.referenceId,
      referenceNumber: stockMovements.referenceNumber,
      notes: stockMovements.notes, createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .where(eq(stockMovements.businessId, context.businessId))
    .orderBy(desc(stockMovements.createdAt))
  return rows
}

/* ------------------------------------------------------------------ */
/* Stock Levels                                                       */
/* ------------------------------------------------------------------ */

export async function listStockLevels() {
  const context = await requireBusinessPermission('stock.adjust')
  const rows = await db
    .select({
      id: stockLevels.id, itemId: stockLevels.itemId,
      warehouseId: stockLevels.warehouseId,
      quantityOnHand: stockLevels.quantityOnHand,
      quantityReserved: stockLevels.quantityReserved,
      quantityAvailable: stockLevels.quantityAvailable,
      lastMovementAt: stockLevels.lastMovementAt,
    })
    .from(stockLevels)
    .where(eq(stockLevels.businessId, context.businessId))
    .orderBy(desc(stockLevels.updatedAt))
  return rows
}

/* ------------------------------------------------------------------ */
/* Purchase Returns                                                     */
/* ------------------------------------------------------------------ */

export async function createPurchaseReturn(input: {
  purchaseOrderId: string; supplierId: string; warehouseId: string;
  returnDate?: string; reason?: string; notes?: string;
}) {
  const context = await requireBusinessPermission('purchase_order.approve')
  const id = randomUUID()
  const number = await allocateDocumentNumber(db as any, context.businessId, 'purchase_order')
  await db.transaction(async (tx) => {
    await tx.insert(purchaseReturns).values({
      id, businessId: context.businessId, purchaseOrderId: input.purchaseOrderId,
      supplierId: input.supplierId, warehouseId: input.warehouseId, number,
      returnDate: input.returnDate || new Date().toISOString().slice(0, 10),
      status: 'draft',
      reason: input.reason?.trim() || null,
      notes: input.notes?.trim() || null,
      createdBy: context.userId,
    })
    await insertAudit(tx, context, { action: 'purchase_return.created', entityType: 'purchase_return', entityId: id, details: { number } })
  })
  revalidatePath('/')
  return { id, number }
}

export async function listPurchaseReturns() {
  const context = await requireBusinessPermission('purchase_order.approve')
  const rows = await db
    .select({
      id: purchaseReturns.id, number: purchaseReturns.number,
      purchaseOrderId: purchaseReturns.purchaseOrderId,
      supplierId: purchaseReturns.supplierId, warehouseId: purchaseReturns.warehouseId,
      status: purchaseReturns.status, returnDate: purchaseReturns.returnDate,
      total: purchaseReturns.total, createdAt: purchaseReturns.createdAt,
    })
    .from(purchaseReturns)
    .where(eq(purchaseReturns.businessId, context.businessId))
    .orderBy(desc(purchaseReturns.createdAt))
  return rows
}

/* ------------------------------------------------------------------ */
/* Quotations                                                         */
/* ------------------------------------------------------------------ */

export async function createQuotation(input: {
  customerId: string;
  validUntil: string;
  notes?: string;
  terms?: string;
  lines: { itemId: string; description: string; quantity: string; unitPrice: string; taxRate: string }[];
}) {
  const context = await requireBusinessPermission('quotation.create')
  loadEnv()

  // Calculate totals
  let subtotal = 0
  let tax = 0
  const linesData: any[] = []
  
  for (const line of input.lines) {
    const quantityMilli = scaledDecimal(line.quantity, 3, 'Quantity')
    const quantity = Number(quantityMilli) / 1000
    const unitCents = money(line.unitPrice)
    const taxRateBasisPoints = scaledDecimal(line.taxRate, 4, 'Tax rate')
    const taxRate = Number(taxRateBasisPoints) / 10000
    const lineSubtotalCents = Number((BigInt(unitCents) * quantityMilli + 500n) / 1000n)
    const lineTaxCents = Number((BigInt(lineSubtotalCents) * taxRateBasisPoints + 500_000n) / 1_000_000n)
    
    const lineSubtotal = Number(lineSubtotalCents) / 100
    const lineTax = Number(lineTaxCents) / 100
    subtotal += lineSubtotal
    tax += lineTax
    linesData.push({
      itemId: line.itemId,
      description: line.description,
      quantity: quantity.toFixed(3),
      unitPrice: (unitCents / 100).toFixed(2),
      taxRate: (Number(taxRateBasisPoints) / 10000).toFixed(4),
      taxAmount: (lineTaxCents / 100).toFixed(2),
      lineTotal: ((lineSubtotalCents + lineTaxCents) / 100).toFixed(2)
    })
  }

  const quotationId = randomUUID()
  const number = await allocateDocumentNumber(db as any, context.businessId, 'quotation')

  await db.transaction(async (tx) => {
    await tx.insert(quotations).values({
      id: quotationId,
      businessId: context.businessId,
      customerId: input.customerId,
      number,
      status: 'draft',
      issueDate: new Date().toISOString().slice(0, 10),
      validUntil: input.validUntil,
      subtotal: subtotal.toFixed(2),
      taxAmount: tax.toFixed(2),
      total: (subtotal + tax).toFixed(2),
      currency: 'UGX',
      notes: input.notes?.trim() || null,
      terms: input.terms?.trim() || null,
      createdBy: context.userId,
    })

    for (const line of linesData) {
      await tx.insert(quotationItems).values({
        id: randomUUID(),
        quotationId,
        itemId: line.itemId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        lineTotal: line.lineTotal,
      })
    }

    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { 
      action: 'quotation.created', entityType: 'quotation', entityId: quotationId, details: { number } 
    })
  })

  revalidatePath('/')
  return { id: quotationId, number }
}

export async function listQuotations(filters?: { status?: string; customerId?: string; fromDate?: string; toDate?: string }) {
  const context = await requireBusinessPermission('quotation.read')
  let whereConditions = [eq(quotations.businessId, context.businessId)]
  
  if (filters?.status) whereConditions.push(eq(quotations.status, filters.status))
  if (filters?.customerId) whereConditions.push(eq(quotations.customerId, filters.customerId))
  if (filters?.fromDate) whereConditions.push(gte(quotations.issueDate, filters.fromDate))
  if (filters?.toDate) whereConditions.push(lte(quotations.issueDate, filters.toDate))

  const rows = await db
    .select({
      id: quotations.id,
      number: quotations.number,
      status: quotations.status,
      issueDate: quotations.issueDate,
      validUntil: quotations.validUntil,
      total: quotations.total,
      currency: quotations.currency,
      customerName: customers.name,
      createdAt: quotations.createdAt,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .where(and(...whereConditions))
    .orderBy(desc(quotations.createdAt))
  
  return rows
}

export async function getQuotation(id: string) {
  const context = await requireBusinessPermission('quotation.read')
  const [quotation] = await db
    .select({
      id: quotations.id,
      number: quotations.number,
      status: quotations.status,
      issueDate: quotations.issueDate,
      validUntil: quotations.validUntil,
      subtotal: quotations.subtotal,
      taxAmount: quotations.taxAmount,
      total: quotations.total,
      currency: quotations.currency,
      notes: quotations.notes,
      terms: quotations.terms,
      customerId: quotations.customerId,
      customerName: customers.name,
      customerEmail: customers.email,
      createdBy: quotations.createdBy,
      createdAt: quotations.createdAt,
      acceptedAt: quotations.acceptedAt,
      convertedAt: quotations.convertedAt,
      convertedSalesOrderId: quotations.convertedSalesOrderId,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .where(and(eq(quotations.id, id), eq(quotations.businessId, context.businessId)))
    .limit(1)

  if (!quotation) throw new Error('Quotation not found.')

  const fetchedItems = await db
    .select({
      id: quotationItems.id,
      itemId: quotationItems.itemId,
      description: quotationItems.description,
      quantity: quotationItems.quantity,
      unitPrice: quotationItems.unitPrice,
      taxRate: quotationItems.taxRate,
      taxAmount: quotationItems.taxAmount,
      lineTotal: quotationItems.lineTotal,
      itemName: items.name,
      itemSku: items.sku,
    })
    .from(quotationItems)
    .leftJoin(items, eq(items.id, quotationItems.itemId))
    .where(eq(quotationItems.quotationId, id))

  return { ...quotation, items: fetchedItems }
}

export async function sendQuotation(input: { quotationId: string }) {
  const context = await requireBusinessPermission('quotation.send')
  await db.transaction(async (tx) => {
    const [quotation] = await tx.select({ 
      id: quotations.id, 
      status: quotations.status, 
      number: quotations.number,
      customerId: quotations.customerId,
      businessId: quotations.businessId 
    }).from(quotations).where(and(eq(quotations.id, input.quotationId), eq(quotations.businessId, context.businessId))).limit(1).for('update')
    
    if (!quotation) throw new Error('Quotation not found.')
    if (quotation.status !== 'draft') throw new Error('Only draft quotations can be sent.')

    await tx.update(quotations).set({ status: 'sent' }).where(eq(quotations.id, input.quotationId))
    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { 
      action: 'quotation.sent', entityType: 'quotation', entityId: input.quotationId 
    })
  })
  revalidatePath('/')
  return { success: true }
}

export async function acceptQuotation(input: { quotationId: string }) {
  const context = await requireBusinessPermission('quotation.accept')
  await db.transaction(async (tx) => {
    const [quotation] = await tx.select({ 
      id: quotations.id, 
      status: quotations.status, 
      number: quotations.number,
      customerId: quotations.customerId,
      businessId: quotations.businessId 
    }).from(quotations).where(and(eq(quotations.id, input.quotationId), eq(quotations.businessId, context.businessId))).limit(1).for('update')
    
    if (!quotation) throw new Error('Quotation not found.')
    if (quotation.status !== 'sent') throw new Error('Only sent quotations can be accepted.')

    await tx.update(quotations).set({ 
      status: 'accepted', 
      acceptedAt: new Date(),
      acceptedBy: context.userId 
    }).where(eq(quotations.id, input.quotationId))
    
    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { 
      action: 'quotation.accepted', entityType: 'quotation', entityId: input.quotationId 
    })
  })
  revalidatePath('/')
  return { success: true }
}

export async function convertQuotationToSalesOrder(input: { quotationId: string; warehouseId: string; expectedDate?: string }) {
  const context = await requireBusinessPermission('sales_order.create')
  
  // Get quotation with items
  const [quotation] = await db
    .select({
      id: quotations.id,
      number: quotations.number,
      status: quotations.status,
      customerId: quotations.customerId,
      businessId: quotations.businessId,
      total: quotations.total,
      subtotal: quotations.subtotal,
      taxAmount: quotations.taxAmount,
      currency: quotations.currency,
    })
    .from(quotations)
    .where(and(eq(quotations.id, input.quotationId), eq(quotations.businessId, context.businessId)))
    .limit(1)

  if (!quotation) throw new Error('Quotation not found.')
  if (quotation.status !== 'accepted') throw new Error('Only accepted quotations can be converted to sales orders.')

  const fetchedItems = await db
    .select({
      itemId: quotationItems.itemId,
      description: quotationItems.description,
      quantity: quotationItems.quantity,
      unitPrice: quotationItems.unitPrice,
      taxRate: quotationItems.taxRate,
      taxAmount: quotationItems.taxAmount,
      lineTotal: quotationItems.lineTotal,
    })
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, input.quotationId))

  if (fetchedItems.length === 0) throw new Error('Quotation has no items.')

  // Validate stock availability for all items
  for (const item of fetchedItems) {
    const [stock] = await db
      .select({ available: stockLevels.quantityAvailable })
      .from(stockLevels)
      .where(and(
        eq(stockLevels.businessId, context.businessId),
        eq(stockLevels.itemId, item.itemId),
        eq(stockLevels.warehouseId, input.warehouseId)
      ))
      .limit(1)

    const requestedQty = Number(item.quantity)
    const available = Number(stock?.available ?? 0)
    
    if (available < requestedQty) {
      throw new Error(`Insufficient stock for item ${item.itemId}. Available: ${available}, Requested: ${requestedQty}`)
    }
  }

  const id = randomUUID()
  const number = await allocateDocumentNumber(db as any, context.businessId, 'sales_order')
  const now = new Date()

  await db.transaction(async (tx) => {
    // Create sales order
    await tx.insert(salesOrders).values({
      id,
      businessId: context.businessId,
      quotationId: input.quotationId,
      customerId: quotation.customerId,
      warehouseId: input.warehouseId,
      number,
      status: 'confirmed',
      orderDate: now.toISOString().slice(0, 10),
      expectedDate: input.expectedDate || null,
      subtotal: quotation.subtotal,
      taxAmount: quotation.taxAmount,
      total: quotation.total,
      currency: quotation.currency,
      createdBy: context.userId,
      confirmedBy: context.userId,
      confirmedAt: now,
    })

    // Create sales order items and reserve stock
    for (const item of fetchedItems) {
      const soiId = randomUUID()
      await tx.insert(salesOrderItems).values({
        id: soiId,
        businessId: context.businessId,
        salesOrderId: id,
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        quantityFulfilled: '0',
        quantityReserved: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
      })

      // Reserve stock
      const reservationId = randomUUID()
      await tx.insert(stockReservations).values({
        id: reservationId,
        businessId: context.businessId,
        salesOrderId: id,
        salesOrderItemId: soiId,
        itemId: item.itemId,
        warehouseId: input.warehouseId,
        quantityReserved: item.quantity,
        quantityFulfilled: '0',
        status: 'active',
        createdBy: context.userId,
      })

      // Update stock_levels: increase reserved
      await tx
        .update(stockLevels)
        .set({
          quantityReserved: sql`${stockLevels.quantityReserved} + ${item.quantity}`,
          quantityAvailable: sql`GREATEST(0, ${stockLevels.quantityOnHand} - ${stockLevels.quantityReserved} - ${item.quantity} - ${stockLevels.quantityAvailable})`,
        })
        .where(and(
          eq(stockLevels.businessId, context.businessId),
          eq(stockLevels.itemId, item.itemId),
          eq(stockLevels.warehouseId, input.warehouseId)
        ))
    }

    // Update quotation status
    await tx.update(quotations)
      .set({ 
        status: 'converted', 
        convertedAt: now, 
        convertedSalesOrderId: id 
      })
      .where(eq(quotations.id, input.quotationId))

    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { 
      action: 'sales_order.created_from_quotation', entityType: 'sales_order', entityId: id, 
      details: { quotationId: input.quotationId, quotationNumber: quotation.number } 
    })
  })

  revalidatePath('/')
  return { id, number }
}

export async function listSalesOrders(filters?: { status?: string; customerId?: string; warehouseId?: string; fromDate?: string; toDate?: string }) {
  const context = await requireBusinessPermission('sales_order.read')
  let whereConditions = [eq(salesOrders.businessId, context.businessId)]
  
  if (filters?.status) whereConditions.push(eq(salesOrders.status, filters.status))
  if (filters?.customerId) whereConditions.push(eq(salesOrders.customerId, filters.customerId))
  if (filters?.warehouseId) whereConditions.push(eq(salesOrders.warehouseId, filters.warehouseId))
  if (filters?.fromDate) whereConditions.push(gte(salesOrders.orderDate, filters.fromDate))
  if (filters?.toDate) whereConditions.push(lte(salesOrders.orderDate, filters.toDate))

  const rows = await db
    .select({
      id: salesOrders.id,
      number: salesOrders.number,
      status: salesOrders.status,
      orderDate: salesOrders.orderDate,
      expectedDate: salesOrders.expectedDate,
      total: salesOrders.total,
      currency: salesOrders.currency,
      customerName: customers.name,
      warehouseName: warehouses.name,
      createdAt: salesOrders.createdAt,
    })
    .from(salesOrders)
    .innerJoin(customers, eq(customers.id, salesOrders.customerId))
    .innerJoin(warehouses, eq(warehouses.id, salesOrders.warehouseId))
    .where(and(...whereConditions))
    .orderBy(desc(salesOrders.createdAt))
  
  return rows
}

export async function getSalesOrder(id: string) {
  const context = await requireBusinessPermission('sales_order.read')
  const [order] = await db
    .select({
      id: salesOrders.id,
      number: salesOrders.number,
      status: salesOrders.status,
      orderDate: salesOrders.orderDate,
      expectedDate: salesOrders.expectedDate,
      subtotal: salesOrders.subtotal,
      taxAmount: salesOrders.taxAmount,
      total: salesOrders.total,
      currency: salesOrders.currency,
      notes: salesOrders.notes,
      customerId: salesOrders.customerId,
      customerName: customers.name,
      warehouseId: salesOrders.warehouseId,
      warehouseName: warehouses.name,
      createdBy: salesOrders.createdBy,
      confirmedBy: salesOrders.confirmedBy,
      confirmedAt: salesOrders.confirmedAt,
      createdAt: salesOrders.createdAt,
    })
    .from(salesOrders)
    .innerJoin(customers, eq(customers.id, salesOrders.customerId))
    .innerJoin(warehouses, eq(warehouses.id, salesOrders.warehouseId))
    .where(and(eq(salesOrders.id, id), eq(salesOrders.businessId, context.businessId)))
    .limit(1)

  if (!order) throw new Error('Sales order not found.')

  const fetchedItems = await db
    .select({
      id: salesOrderItems.id,
      itemId: salesOrderItems.itemId,
      description: salesOrderItems.description,
      quantity: salesOrderItems.quantity,
      quantityFulfilled: salesOrderItems.quantityFulfilled,
      quantityReserved: salesOrderItems.quantityReserved,
      unitPrice: salesOrderItems.unitPrice,
      taxRate: salesOrderItems.taxRate,
      taxAmount: salesOrderItems.taxAmount,
      lineTotal: salesOrderItems.lineTotal,
      itemName: items.name,
      itemSku: items.sku,
      reservations: sql<{ id: string; quantityReserved: string; quantityFulfilled: string; status: string }[]>`
        SELECT json_agg(json_build_object(
          'id', sr.id,
          'quantityReserved', sr.quantity_reserved,
          'quantityFulfilled', sr.quantity_fulfilled,
          'status', sr.status
        ))
        FROM stock_reservations sr
        WHERE sr.sales_order_item_id = ${salesOrderItems.id}
      `,
    })
    .from(salesOrderItems)
    .leftJoin(items, eq(items.id, salesOrderItems.itemId))
    .where(eq(salesOrderItems.salesOrderId, id))

  return { ...order, items: fetchedItems }
}

export async function confirmSalesOrder(input: { salesOrderId: string }) {
  const context = await requireBusinessPermission('sales_order.confirm')
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ 
      id: salesOrders.id, 
      status: salesOrders.status, 
      businessId: salesOrders.businessId 
    }).from(salesOrders).where(and(eq(salesOrders.id, input.salesOrderId), eq(salesOrders.businessId, context.businessId))).limit(1).for('update')
    
    if (!order) throw new Error('Sales order not found.')
    if (order.status !== 'draft') throw new Error('Only draft sales orders can be confirmed.')

    await tx.update(salesOrders).set({ 
      status: 'confirmed', 
      confirmedAt: new Date(),
      confirmedBy: context.userId 
    }).where(eq(salesOrders.id, input.salesOrderId))
    
    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { 
      action: 'sales_order.confirmed', entityType: 'sales_order', entityId: input.salesOrderId 
    })
  })
  revalidatePath('/')
  return { success: true }
}

export async function fulfillSalesOrderItem(input: { salesOrderId: string; salesOrderItemId: string; quantity: string; warehouseId?: string }) {
  const context = await requireBusinessPermission('sales_order.fulfill')
  const quantity = Number(input.quantity)
  if (quantity <= 0) throw new Error('Quantity must be greater than zero.')

  await db.transaction(async (tx) => {
    const [soi] = await tx.select({ 
      id: salesOrderItems.id, 
      salesOrderId: salesOrderItems.salesOrderId,
      itemId: salesOrderItems.itemId,
      quantity: salesOrderItems.quantity,
      quantityFulfilled: salesOrderItems.quantityFulfilled,
      quantityReserved: salesOrderItems.quantityReserved,
      businessId: salesOrderItems.businessId,
      status: salesOrderItems.status
    }).from(salesOrderItems).where(and(eq(salesOrderItems.id, input.salesOrderItemId), eq(salesOrderItems.salesOrderId, input.salesOrderId))).limit(1).for('update')
    
    if (!soi) throw new Error('Sales order item not found.')
    if (soi.status === 'cancelled') throw new Error('Cannot fulfill cancelled order item.')
    
    const requestedQty = Number(input.quantity)
    const alreadyFulfilled = Number(soi.quantityFulfilled)
    const maxFulfillable = Number(soi.quantity) - alreadyFulfilled
    
    if (requestedQty > maxFulfillable) throw new Error(`Cannot fulfill more than ordered. Max fulfillable: ${maxFulfillable}`)

    const warehouseId = input.warehouseId || (await tx.select({ warehouseId: salesOrders.warehouseId }).from(salesOrders).where(eq(salesOrders.id, input.salesOrderId)).limit(1))[0]?.warehouseId
    if (!warehouseId) throw new Error('Warehouse not specified.')

    // Check stock availability
    const [stock] = await tx.select({ available: stockLevels.quantityAvailable }).from(stockLevels).where(and(eq(stockLevels.businessId, soi.businessId), eq(stockLevels.itemId, soi.itemId), eq(stockLevels.warehouseId, warehouseId))).limit(1)
    const available = Number(stock?.available ?? 0)
    
    if (available < quantity) throw new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity}`)

    // Fulfill from reservation
    const reservationRows = await tx.select({ 
      id: stockReservations.id, 
      status: stockReservations.status,
      quantityFulfilled: stockReservations.quantityFulfilled, 
      quantityReserved: stockReservations.quantityReserved,
      itemId: stockReservations.itemId,
      warehouseId: stockReservations.warehouseId,
      businessId: stockReservations.businessId,
    }).from(stockReservations).where(and(eq(stockReservations.salesOrderItemId, input.salesOrderItemId), eq(stockReservations.status, 'active'))).limit(1).for('update')
    const reservation = reservationRows[0]
    
    if (reservation) {
      const newFulfilled = Number(reservation.quantityFulfilled) + quantity
      const newStatus = newFulfilled >= Number(reservation.quantityReserved) ? 'fulfilled' : 'partially_fulfilled'
      
      await tx.update(stockReservations)
        .set({ quantityFulfilled: newFulfilled.toFixed(3), status: newStatus })
        .where(eq(stockReservations.id, reservation.id))
    }

    // Update stock levels: decrease reserved, increase fulfilled, decrease on_hand
    await tx.update(stockLevels)
      .set({
        quantityReserved: sql`${stockLevels.quantityReserved} - ${quantity}`,
        quantityOnHand: sql`${stockLevels.quantityOnHand} - ${quantity}`,
        quantityAvailable: sql`GREATEST(0, ${stockLevels.quantityOnHand} - ${quantity} - ${stockLevels.quantityReserved} + ${quantity} - ${stockLevels.quantityAvailable})`,
        lastMovementAt: new Date(),
      })
      .where(and(eq(stockLevels.businessId, soi.businessId), eq(stockLevels.itemId, soi.itemId), eq(stockLevels.warehouseId, warehouseId)))

    // Record stock movement
    await tx.insert(stockMovements).values({
      id: randomUUID(),
      businessId: soi.businessId,
      itemId: soi.itemId,
      warehouseId: warehouseId,
      movementType: 'out',
      quantity: quantity.toFixed(3),
      referenceType: 'sales_order',
      referenceId: input.salesOrderId,
      referenceNumber: (await tx.select({ number: salesOrders.number }).from(salesOrders).where(eq(salesOrders.id, input.salesOrderId)).limit(1))[0]?.number,
      notes: `Sales order fulfillment`,
      createdBy: context.userId,
    })

    // Update sales order item
    const newFulfilled = (Number(soi.quantityFulfilled) + quantity).toFixed(3)
    const newStatus = Number(newFulfilled) >= Number(soi.quantity) ? 'fulfilled' : 'partially_fulfilled'
    
    await tx.update(salesOrderItems)
      .set({ quantityFulfilled: newFulfilled, status: newStatus })
      .where(eq(salesOrderItems.id, input.salesOrderItemId))

    // Update sales order status
    const [order] = await tx.select({ status: salesOrders.status }).from(salesOrders).where(eq(salesOrders.id, input.salesOrderId)).limit(1)
    const allItems = await tx.select({ quantity: salesOrderItems.quantity, quantityFulfilled: salesOrderItems.quantityFulfilled }).from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, input.salesOrderId))
    const allFulfilled = allItems.every(i => Number(i.quantityFulfilled) >= Number(i.quantity))
    const anyFulfilled = allItems.some(i => Number(i.quantityFulfilled) > 0)
    
    let newOrderStatus = order.status
    if (allFulfilled) newOrderStatus = 'fulfilled'
    else if (anyFulfilled) newOrderStatus = 'partially_fulfilled'
    
    if (newOrderStatus !== order.status) {
      await tx.update(salesOrders).set({ status: newOrderStatus }).where(eq(salesOrders.id, input.salesOrderId))
    }

    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { 
      action: 'sales_order.fulfilled', entityType: 'sales_order_item', entityId: input.salesOrderItemId, 
      details: { quantity, salesOrderId: input.salesOrderId } 
    })
  })
  
  revalidatePath('/')
  return { success: true }
}

export async function cancelSalesOrder(input: { salesOrderId: string }) {
  const context = await requireBusinessPermission('sales_order.cancel')
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ 
      id: salesOrders.id, 
      status: salesOrders.status, 
      businessId: salesOrders.businessId 
    }).from(salesOrders).where(and(eq(salesOrders.id, input.salesOrderId), eq(salesOrders.businessId, context.businessId))).limit(1).for('update')
    
    if (!order) throw new Error('Sales order not found.')
    if (order.status === 'fulfilled' || order.status === 'cancelled') throw new Error('Cannot cancel fulfilled or already cancelled order.')

    // Release all reservations
    const reservations = await tx.select({ id: stockReservations.id, itemId: stockReservations.itemId, warehouseId: stockReservations.warehouseId, quantityReserved: stockReservations.quantityReserved, quantityFulfilled: stockReservations.quantityFulfilled }).from(stockReservations).where(eq(stockReservations.salesOrderId, input.salesOrderId)).for('update')
    
    for (const res of reservations) {
      const qtyToRelease = Number(res.quantityReserved) - Number(res.quantityFulfilled || 0)
      if (qtyToRelease > 0) {
        await tx.update(stockLevels)
          .set({
            quantityReserved: sql`${stockLevels.quantityReserved} - ${qtyToRelease}`,
            quantityAvailable: sql`GREATEST(0, ${stockLevels.quantityOnHand} - ${stockLevels.quantityReserved} + ${qtyToRelease} - ${stockLevels.quantityAvailable})`,
          })
          .where(and(eq(stockLevels.businessId, context.businessId), eq(stockLevels.itemId, res.itemId), eq(stockLevels.warehouseId, res.warehouseId)))
      }
      await tx.update(stockReservations).set({ status: 'released', releasedAt: new Date(), releasedBy: context.userId }).where(eq(stockReservations.id, res.id))
    }

    // Release stock_order_items reservations
    await tx.update(salesOrderItems).set({ quantityReserved: '0' }).where(eq(salesOrderItems.salesOrderId, input.salesOrderId))

    await tx.update(salesOrders).set({ status: 'cancelled' }).where(eq(salesOrders.id, input.salesOrderId))
    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { action: 'sales_order.cancelled', entityType: 'sales_order', entityId: input.salesOrderId })
  })
  revalidatePath('/')
  return { success: true }
}

/* ------------------------------------------------------------------ */
/* Stock Reservations                                                 */
/* ------------------------------------------------------------------ */

export async function listStockReservations(filters?: { salesOrderId?: string; itemId?: string; warehouseId?: string; status?: string }) {
  const context = await requireBusinessPermission('stock.adjust')
  let whereConditions = [eq(stockReservations.businessId, context.businessId)]
  
  if (filters?.salesOrderId) whereConditions.push(eq(stockReservations.salesOrderId, filters.salesOrderId))
  if (filters?.itemId) whereConditions.push(eq(stockReservations.itemId, filters.itemId))
  if (filters?.warehouseId) whereConditions.push(eq(stockReservations.warehouseId, filters.warehouseId))
  if (filters?.status) whereConditions.push(eq(stockReservations.status, filters.status))

  const rows = await db
    .select({
      id: stockReservations.id,
      salesOrderId: stockReservations.salesOrderId,
      salesOrderItemId: stockReservations.salesOrderItemId,
      itemId: stockReservations.itemId,
      itemName: items.name,
      warehouseId: stockReservations.warehouseId,
      warehouseName: warehouses.name,
      quantityReserved: stockReservations.quantityReserved,
      quantityFulfilled: stockReservations.quantityFulfilled,
      status: stockReservations.status,
      createdAt: stockReservations.createdAt,
    })
    .from(stockReservations)
    .leftJoin(items, eq(items.id, stockReservations.itemId))
    .leftJoin(warehouses, eq(warehouses.id, stockReservations.warehouseId))
    .where(and(...whereConditions))
    .orderBy(desc(stockReservations.createdAt))
  return rows
}

export async function releaseStockReservation(input: { reservationId: string }) {
  const context = await requireBusinessPermission('stock.adjust')
  await db.transaction(async (tx) => {
    const [reservation] = await tx.select({ 
      id: stockReservations.id, 
      status: stockReservations.status,
      quantityReserved: stockReservations.quantityReserved,
      quantityFulfilled: stockReservations.quantityFulfilled,
      itemId: stockReservations.itemId,
      warehouseId: stockReservations.warehouseId,
      businessId: stockReservations.businessId 
    }).from(stockReservations).where(eq(stockReservations.id, input.reservationId)).limit(1).for('update')
    
    if (!reservation) throw new Error('Reservation not found.')
    if (reservation.status === 'released' || reservation.status === 'cancelled') throw new Error('Reservation already released or cancelled.')

    const qtyToRelease = Number(reservation.quantityReserved) - Number(reservation.quantityFulfilled || 0)
    if (qtyToRelease > 0) {
      await tx.update(stockLevels)
        .set({
          quantityReserved: sql`${stockLevels.quantityReserved} - ${qtyToRelease}`,
          quantityAvailable: sql`GREATEST(0, ${stockLevels.quantityOnHand} - ${stockLevels.quantityReserved} + ${qtyToRelease} - ${stockLevels.quantityAvailable})`,
        })
        .where(and(eq(stockLevels.businessId, context.businessId), eq(stockLevels.itemId, reservation.itemId), eq(stockLevels.warehouseId, reservation.warehouseId)))
    }

    await tx.update(stockReservations).set({ status: 'released', releasedAt: new Date(), releasedBy: context.userId }).where(eq(stockReservations.id, input.reservationId))
    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { action: 'stock_reservation.released', entityType: 'stock_reservation', entityId: input.reservationId })
  })
  revalidatePath('/')
  return { success: true }
}

/* ------------------------------------------------------------------ */
/* Stock Availability                                                 */
/* ------------------------------------------------------------------ */

export async function checkStockAvailability(input: { itemId: string; warehouseId: string; quantity: string }) {
  const context = await requireBusinessPermission('stock.adjust')
  const quantity = Number(input.quantity)
  if (quantity <= 0) throw new Error('Quantity must be greater than zero.')

  const [stock] = await db
    .select({ 
      quantityOnHand: stockLevels.quantityOnHand,
      quantityReserved: stockLevels.quantityReserved,
      quantityUnavailable: stockLevels.quantityAvailable,
      quantityAvailable: stockLevels.quantityAvailable,
    })
    .from(stockLevels)
    .where(and(eq(stockLevels.businessId, context.businessId), eq(stockLevels.itemId, input.itemId), eq(stockLevels.warehouseId, input.warehouseId)))
    .limit(1)

  const available = Number(stock?.quantityAvailable ?? 0)
  const requested = Number(input.quantity)
  
  return {
    available: available >= quantity,
    availableQty: available,
    requested: requested,
    shortage: Math.max(0, requested - available),
    onHand: Number(stock?.quantityOnHand ?? 0),
    reserved: Number(stock?.quantityReserved ?? 0),
    unavailable: Number(stock?.quantityUnavailable ?? 0),
  }
}

/* ------------------------------------------------------------------ */
/* Inventory Valuation (FIFO & Weighted Average)                      */
/* ------------------------------------------------------------------ */

export async function getInventoryValuation(filters?: { warehouseId?: string; valuationGroupId?: string; costingMethod?: 'fifo' | 'weighted_average' }) {
  const context = await requireBusinessPermission('reports.read')
  
  // Get valuation groups for this business
  const groups = await db
    .select()
    .from(valuationGroups)
    .where(eq(valuationGroups.businessId, context.businessId))

  const results = []
  
  for (const group of groups) {
    if (filters?.valuationGroupId && filters.valuationGroupId !== group.id) continue
    if (filters?.costingMethod && filters.costingMethod !== group.costingMethod) continue

    // Get items in this valuation group
    const fetchedItems = await db
      .select({ id: items.id, name: items.name, sku: items.sku, averageCost: items.averageCost })
      .from(items)
      .where(and(eq(items.businessId, context.businessId), eq(items.valuationGroupId, group.id)))

    let totalValue = 0
    const itemValuations = []

    for (const item of fetchedItems) {
      if (group.costingMethod === 'fifo') {
        // FIFO: sum of costing layers
        const layers = await db
          .select({ quantityRemaining: costingLayers.quantityRemaining, unitCost: costingLayers.unitCost })
          .from(costingLayers)
          .where(and(
            eq(costingLayers.businessId, context.businessId),
            eq(costingLayers.itemId, item.id),
            eq(costingLayers.isActive, true),
            eq(costingLayers.valuationGroupId, group.id)
          ))
          .orderBy(costingLayers.receivedDate)

        let itemValue = 0
        for (const layer of layers) {
          itemValue += Number(layer.quantityRemaining) * Number(layer.unitCost)
        }
        totalValue += itemValue
        itemValuations.push({ itemId: item.id, itemName: item.name, sku: item.sku, value: itemValue, layers: layers.length })
      } else {
        // Weighted Average
        const [stock] = await db
          .select({ 
            totalQty: sql<number>`coalesce(sum(${stockLevels.quantityOnHand}),0)`,
            avgCost: items.averageCost 
          })
          .from(stockLevels)
          .innerJoin(items, eq(items.id, stockLevels.itemId))
          .where(and(
            eq(stockLevels.businessId, context.businessId),
            eq(stockLevels.itemId, item.id)
          ))

        const itemValue = Number(stock.totalQty) * Number(stock.avgCost ?? 0)
        totalValue += itemValue
        itemValuations.push({ itemId: item.id, itemName: item.name, sku: item.sku, value: itemValue, avgCost: stock.avgCost })
      }
    }

    results.push({
      valuationGroupId: group.id,
      valuationGroupName: group.name,
      costingMethod: group.costingMethod,
      totalValue,
      itemCount: fetchedItems.length,
      items: itemValuations,
    })
  }

  return { groups: results, grandTotal: results.reduce((sum, g) => sum + g.totalValue, 0) }
}

export async function recordCostingLayer(input: {
  itemId: string;
  warehouseId: string;
  quantityReceived: string;
  unitCost: string;
  receivedDate: string;
  sourceType: 'purchase' | 'adjustment' | 'return' | 'transfer_in' | 'opening_balance';
  sourceReferenceId?: string;
  sourceReferenceType?: string;
  valuationGroupId?: string;
}) {
  const context = await requireBusinessPermission('stock.adjust')
  const quantity = Number(input.quantityReceived)
  const unitCost = money(input.unitCost) / 10000 // 4 decimal places for costing

  if (quantity <= 0) throw new Error('Quantity received must be positive.')
  if (unitCost < 0) throw new Error('Unit cost cannot be negative.')

  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(costingLayers).values({
      id,
      businessId: context.businessId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      quantityReceived: quantity.toFixed(3),
      quantityRemaining: input.quantityReceived,
      unitCost: (unitCost).toFixed(4),
      unitCostCurrency: 'UGX',
      receivedDate: input.receivedDate,
      sourceType: input.sourceType,
      sourceReferenceId: input.sourceReferenceId || null,
      sourceReferenceType: input.sourceReferenceType || null,
      valuationGroupId: input.valuationGroupId || null,
    })
    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { 
      action: 'costing_layer.created', entityType: 'costing_layer', entityId: id, 
      details: { quantity: input.quantityReceived, unitCost: input.unitCost } 
    })
  })
  revalidatePath('/')
  return { id }
}

export async function getCostingLayers(filters?: { itemId?: string; warehouseId?: string; valuationGroupId?: string; activeOnly?: boolean }) {
  const context = await requireBusinessPermission('reports.read')
  let whereConditions = [eq(costingLayers.businessId, context.businessId)]
  
  if (filters?.itemId) whereConditions.push(eq(costingLayers.itemId, filters.itemId))
  if (filters?.warehouseId) whereConditions.push(eq(costingLayers.warehouseId, filters.warehouseId))
  if (filters?.valuationGroupId) whereConditions.push(eq(costingLayers.valuationGroupId, filters.valuationGroupId))
  if (filters?.activeOnly !== false) whereConditions.push(eq(costingLayers.isActive, true))

  const rows = await db
    .select({
      id: costingLayers.id,
      itemId: costingLayers.itemId,
      itemName: items.name,
      itemSku: items.sku,
      warehouseId: costingLayers.warehouseId,
      warehouseName: warehouses.name,
      quantityReceived: costingLayers.quantityReceived,
      quantityRemaining: costingLayers.quantityRemaining,
      unitCost: costingLayers.unitCost,
      unitCostCurrency: costingLayers.unitCostCurrency,
      receivedDate: costingLayers.receivedDate,
      sourceType: costingLayers.sourceType,
      sourceReferenceId: costingLayers.sourceReferenceId,
      sourceReferenceType: costingLayers.sourceReferenceType,
      valuationGroupId: costingLayers.valuationGroupId,
      valuationGroupName: valuationGroups.name,
      isActive: costingLayers.isActive,
      createdAt: costingLayers.createdAt,
    })
    .from(costingLayers)
    .leftJoin(items, eq(items.id, costingLayers.itemId))
    .leftJoin(warehouses, eq(warehouses.id, costingLayers.warehouseId))
    .leftJoin(valuationGroups, eq(valuationGroups.id, costingLayers.valuationGroupId))
    .where(and(...whereConditions))
    .orderBy(costingLayers.receivedDate)
  return rows
}

/* ------------------------------------------------------------------ */
/* Valuation Groups                                                   */
/* ------------------------------------------------------------------ */

export async function createValuationGroup(input: { name: string; costingMethod: 'fifo' | 'weighted_average'; description?: string; isDefault?: boolean }) {
  const context = await requireBusinessPermission('business.settings')
  
  if (input.isDefault) {
    // Ensure only one default per business
    await db.update(valuationGroups).set({ isDefault: false }).where(eq(valuationGroups.businessId, context.businessId))
  }

  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(valuationGroups).values({
      id,
      businessId: context.businessId,
      name: input.name.trim(),
      costingMethod: input.costingMethod,
      description: input.description?.trim() || null,
      isDefault: input.isDefault || false,
    })
    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { 
      action: 'valuation_group.created', entityType: 'valuation_group', entityId: id, details: { costingMethod: input.costingMethod } 
    })
  })
  revalidatePath('/')
  return { id }
}

export async function listValuationGroups() {
  const context = await requireBusinessPermission('business.settings')
  const rows = await db
    .select()
    .from(valuationGroups)
    .where(eq(valuationGroups.businessId, context.businessId))
    .orderBy(valuationGroups.createdAt)
  return rows
}

export async function updateValuationGroup(input: { id: string; name?: string; costingMethod?: 'fifo' | 'weighted_average'; description?: string; isDefault?: boolean }) {
  const context = await requireBusinessPermission('business.settings')
  const updates: Record<string, unknown> = {}
  
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.costingMethod !== undefined) updates.costingMethod = input.costingMethod
  if (input.description !== undefined) updates.description = input.description?.trim() || null
  if (input.isDefault !== undefined) {
    updates.isDefault = input.isDefault
    if (input.isDefault) {
      // Ensure only one default per business
      await db.update(valuationGroups).set({ isDefault: false }).where(eq(valuationGroups.businessId, context.businessId))
    }
  }

  const [existing] = await db.select({ id: valuationGroups.id }).from(valuationGroups).where(and(eq(valuationGroups.id, input.id), eq(valuationGroups.businessId, context.businessId))).limit(1)
  if (!existing) throw new Error('Valuation group not found.')

  await db.transaction(async (tx) => {
    await tx.update(valuationGroups).set(updates).where(and(eq(valuationGroups.id, input.id), eq(valuationGroups.businessId, context.businessId)))
    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { action: 'valuation_group.updated', entityType: 'valuation_group', entityId: input.id })
  })
  revalidatePath('/')
  return { id: input.id }
}

export async function assignItemToValuationGroup(input: { itemId: string; valuationGroupId: string }) {
  const context = await requireBusinessPermission('catalogue.manage')
  
  const [existing] = await db.select({ id: items.id }).from(items).where(and(eq(items.id, input.itemId), eq(items.businessId, context.businessId))).limit(1)
  if (!existing) throw new Error('Item not found.')

  const [group] = await db.select({ id: valuationGroups.id, costingMethod: valuationGroups.costingMethod }).from(valuationGroups).where(and(eq(valuationGroups.id, input.valuationGroupId), eq(valuationGroups.businessId, context.businessId))).limit(1)
  if (!group) throw new Error('Valuation group not found.')

  await db.transaction(async (tx) => {
    await tx.update(items).set({ valuationGroupId: input.valuationGroupId }).where(and(eq(items.id, input.itemId), eq(items.businessId, context.businessId)))
    await insertAudit(tx, { userId: context.userId, businessId: context.businessId }, { action: 'item.assigned_valuation_group', entityType: 'item', entityId: input.itemId, details: { valuationGroupId: input.valuationGroupId, costingMethod: group.costingMethod } })
  })
  revalidatePath('/')
  return { success: true }
}

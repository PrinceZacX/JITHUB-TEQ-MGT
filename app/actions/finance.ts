'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  auditLogs, businesses, businessMemberships, businessRoles, catalogueItems, customers,
  documentSequences, expenses, goodsReceipts, goodsReceiptLines,
  invoiceItems, invoices, items, paymentAllocations, payments,
  purchaseOrderLines, purchaseOrders, purchaseReturnLines, purchaseReturns,
  receipts, refunds, stockLevels, stockMovements, suppliers, taxRates,
  user, verification, warehouses,
} from '@/lib/db/schema'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import {
  requirePermission, defaultRole, type BusinessRole,
  platformHasPermission, requirePlatformPermission, type PlatformPermission,
} from '@/lib/permissions'
import { loadEnv } from '@/lib/env'
import { sendInvoiceEmail, sendReceiptEmail } from '@/lib/email'

const moneyPattern = /^\d{1,12}(\.\d{1,2})?$/

async function requireUser(): Promise<string> {
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

async function requireBusiness(businessId?: string) {
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

async function requireBusinessPermission(permission: string, businessId?: string): Promise<{
  userId: string; businessId: string; role: BusinessRole | 'platform_owner'; isPlatformOwner: boolean
}> {
  const context = await requireBusiness(businessId)
  if (context.role === 'platform_owner') {
    if (!context.businessId) {
      throw new Error('Please select a business before performing business-scoped operations.')
    }
    requirePlatformPermission('platform_owner', permission as PlatformPermission)
    return { userId: context.userId, businessId: context.businessId!, role: 'platform_owner', isPlatformOwner: true }
  }
  requirePermission(context.role as BusinessRole, permission as any)
  return { userId: context.userId, businessId: context.businessId!, role: context.role as BusinessRole, isPlatformOwner: false }
}

async function insertAudit(tx: any, context: { userId: string; businessId: string | null }, input: {
  action: string; entityType: string; entityId: string; details?: Record<string, unknown> }) {
  await tx.insert(auditLogs).values({
    id: randomUUID(), businessId: context.businessId, userId: context.userId,
    action: input.action, entityType: input.entityType, entityId: input.entityId,
    details: input.details ?? {},
  })
}

async function insertPlatformAudit(tx: any, context: { userId: string }, input: {
  action: string; entityType: string; entityId: string; details?: Record<string, unknown> }) {
  await tx.insert(auditLogs).values({
    id: randomUUID(), businessId: null, userId: context.userId,
    action: input.action, entityType: input.entityType, entityId: input.entityId,
    details: input.details ?? {},
  })
}

async function allocateDocumentNumber(tx: any, businessId: string, documentType: 'invoice' | 'receipt' | 'purchase_order') {
  const now = new Date()
  const year = now.getFullYear()
  const [row] = await tx
    .select().from(documentSequences)
    .where(and(eq(documentSequences.businessId, businessId), eq(documentSequences.documentType, documentType)))
    .for('update').limit(1)
  const [business] = await tx.select({ invoicePrefix: businesses.invoicePrefix, receiptPrefix: businesses.receiptPrefix }).from(businesses).where(eq(businesses.id, businessId)).limit(1)
  if (!business) throw new Error('Business not found.')
  const prefix = documentType === 'invoice' ? business.invoicePrefix : documentType === 'receipt' ? business.receiptPrefix : 'PO'
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

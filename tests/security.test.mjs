import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const finance = fs.readFileSync(new URL('../app/actions/finance.ts', import.meta.url), 'utf8')
const permissions = fs.readFileSync(new URL('../lib/permissions.ts', import.meta.url), 'utf8')
const schema = fs.readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8')

/* ------------------------------------------------------------------ */
/* Security: Cross-business data isolation                            */
/* ------------------------------------------------------------------ */

test('every server action scopes queries by businessId', () => {
  // createCustomer
  assert.match(finance, /eq\(customers\.businessId, context\.businessId\)/)
  // updateCustomer
  assert.match(finance, /eq\(customers\.businessId, context\.businessId\)/)
  // createInvoice
  assert.match(finance, /eq\(customers\.businessId, context\.businessId\)/)
  assert.match(finance, /eq\(invoices\.businessId, context\.businessId\)/)
  // issueDraftInvoice
  assert.match(finance, /eq\(invoices\.businessId, context\.businessId\)/)
  // recordPayment
  assert.match(finance, /eq\(invoices\.businessId, context\.businessId\)/)
  assert.match(finance, /eq\(payments\.businessId, context\.businessId\)/)
  assert.match(finance, /eq\(receipts\.businessId, context\.businessId\)/)
  // recordRefund
  assert.match(finance, /eq\(payments\.businessId, context\.businessId\)/)
  assert.match(finance, /eq\(refunds\.businessId, context\.businessId\)/)
  // approveRefund / completeRefund
  assert.match(finance, /eq\(refunds\.businessId, context\.businessId\)/)
  // voidReceipt
  assert.match(finance, /eq\(receipts\.businessId, context\.businessId\)/)
  // cancelInvoice
  assert.match(finance, /eq\(invoices\.businessId, context\.businessId\)/)
  // recordExpense (scoped via INSERT values)
  assert.match(finance, /businessId: context\.businessId, userId: context\.userId, category/)
  // saveCatalogueItem / setCatalogueItemStatus
  assert.match(finance, /eq\(catalogueItems\.businessId, context\.businessId\)/)
})

test('getDashboardData scopes all queries by businessId', () => {
  assert.match(finance, /eq\(customers\.businessId, businessId\)/)
  assert.match(finance, /eq\(invoices\.businessId, businessId\)/)
  assert.match(finance, /eq\(receipts\.businessId, businessId\)/)
  assert.match(finance, /eq\(expenses\.businessId, businessId\)/)
  assert.match(finance, /eq\(catalogueItems\.businessId, businessId\)/)
  assert.match(finance, /eq\(auditLogs\.businessId, businessId\)/)
  assert.match(finance, /eq\(refunds\.businessId, businessId\)/)
})

test('getFinancialReport scopes all queries by businessId', () => {
  assert.match(finance, /eq\(invoices\.businessId, businessId\)/)
  assert.match(finance, /eq\(payments\.businessId, businessId\)/)
  assert.match(finance, /eq\(expenses\.businessId, businessId\)/)
})

/* ------------------------------------------------------------------ */
/* Security: Permission enforcement                                   */
/* ------------------------------------------------------------------ */

test('customer creation requires customer.manage permission', () => {
  assert.match(finance, /requireBusinessPermission\('customer\.manage'\)/)
})

test('invoice creation requires invoice.create or invoice.issue', () => {
  assert.match(finance, /requireBusinessPermission\(input\.status === 'issued' \? 'invoice\.issue' : 'invoice\.create'\)/)
})

test('invoice issuance requires invoice.issue permission', () => {
  assert.match(finance, /requireBusinessPermission\('invoice\.issue'\)/)
})

test('payment recording requires payment.record permission', () => {
  assert.match(finance, /requireBusinessPermission\('payment\.record'\)/)
})

test('refund creation requires refund.create permission', () => {
  assert.match(finance, /requireBusinessPermission\('refund\.create'\)/)
})

test('refund approval requires refund.approve permission', () => {
  assert.match(finance, /requireBusinessPermission\('refund\.approve'\)/)
})

test('receipt voiding requires receipt.void permission', () => {
  assert.match(finance, /requireBusinessPermission\('receipt\.void'\)/)
})

test('invoice cancellation requires invoice.cancel permission', () => {
  assert.match(finance, /requireBusinessPermission\('invoice\.cancel'\)/)
})

test('expense recording requires expense.record permission', () => {
  assert.match(finance, /requireBusinessPermission\('expense\.record'\)/)
})

test('report reading requires reports.read permission', () => {
  assert.match(finance, /requireBusinessPermission\('reports\.read'\)/)
})

test('business settings requires business.settings permission', () => {
  assert.match(finance, /requireBusinessPermission\('business\.settings'\)/)
})

/* ------------------------------------------------------------------ */
/* Security: Role-based access matrix                                 */
/* ------------------------------------------------------------------ */

test('viewer role has only read permissions', () => {
  const viewerBlock = permissions.match(/viewer: \[[\s\S]*?\]/)
  assert.ok(viewerBlock, 'viewer role block should exist')
  assert.match(viewerBlock[0], /'business\.read'/)
  assert.match(viewerBlock[0], /'reports\.read'/)
  assert.match(viewerBlock[0], /'audit\.read'/)
  assert.doesNotMatch(viewerBlock[0], /'payment\.record'/)
  assert.doesNotMatch(viewerBlock[0], /'invoice\.issue'/)
  assert.doesNotMatch(viewerBlock[0], /'refund\.create'/)
  assert.doesNotMatch(viewerBlock[0], /'receipt\.void'/)
})

test('cashier role cannot issue invoices or approve refunds', () => {
  const cashierBlock = permissions.match(/cashier: \[[\s\S]*?\]/)
  assert.ok(cashierBlock, 'cashier role block should exist')
  assert.match(cashierBlock[0], /'payment\.record'/)
  assert.match(cashierBlock[0], /'receipt\.void'/)
  assert.doesNotMatch(cashierBlock[0], /'invoice\.issue'/)
  assert.doesNotMatch(cashierBlock[0], /'refund\.approve'/)
  assert.doesNotMatch(cashierBlock[0], /'invoice\.cancel'/)
})

test('finance_manager can approve refunds but cannot manage memberships', () => {
  const fmBlock = permissions.match(/finance_manager: \[[\s\S]*?\]/)
  assert.ok(fmBlock, 'finance_manager role block should exist')
  assert.match(fmBlock[0], /'refund\.approve'/)
  assert.doesNotMatch(fmBlock[0], /'membership\.manage'/)
})

test('owner has all permissions', () => {
  const ownerBlock = permissions.match(/owner: \[[\s\S]*?\]/)
  assert.ok(ownerBlock, 'owner role block should exist')
  const allPermissions = [
    'business.read', 'business.manage', 'business.settings', 'membership.manage',
    'customer.manage', 'catalogue.manage', 'invoice.create', 'invoice.issue', 'invoice.cancel',
    'payment.record', 'refund.create', 'refund.approve', 'receipt.void', 'expense.record',
    'reports.read', 'audit.read',
  ]
  for (const perm of allPermissions) {
    assert.match(ownerBlock[0], new RegExp(`'${perm}'`))
  }
})

/* ------------------------------------------------------------------ */
/* Security: Financial integrity                                      */
/* ------------------------------------------------------------------ */

test('payment cannot exceed outstanding balance', () => {
  assert.match(finance, /if \(amount > remaining\) throw new Error\('Payment exceeds the outstanding balance\.'\)/)
})

test('refund cannot exceed refundable amount', () => {
  assert.match(finance, /if \(amount > refundable\) throw new Error\('Refund exceeds the refundable amount\.'\)/)
})

test('cancel invoice rejects invoices with payments', () => {
  assert.match(finance, /if \(money\(invoice\.amountPaid\) > 0\) throw new Error\('Cannot cancel an invoice that has received payments\./)
})

test('idempotency key on payment', () => {
  assert.match(schema, /idempotencyKey: text\('idempotency_key'\)/)
  assert.match(finance, /eq\(payments\.idempotencyKey, idempotencyKey\)/)
})

test('idempotency key on refund', () => {
  assert.match(schema, /idempotencyKey: text\('idempotency_key'\)/)
  assert.match(finance, /eq\(refunds\.idempotencyKey, idempotencyKey\)/)
})

test('receipt status includes voided', () => {
  assert.match(schema, /'issued','voided'/)
})

test('invoice status includes cancelled', () => {
  assert.match(schema, /'draft','issued','partially_paid','paid','overdue','cancelled'/)
})

test('refund status includes pending approved completed rejected', () => {
  assert.match(schema, /'pending','approved','completed','rejected'/)
})

/* ------------------------------------------------------------------ */
/* Security: Audit logging                                            */
/* ------------------------------------------------------------------ */

test('financial actions insert audit records', () => {
  assert.match(finance, /action: 'customer\.created'/)
  assert.match(finance, /action: 'customer\.updated'/)
  assert.match(finance, /'invoice\.draft_created'/)
  assert.match(finance, /'invoice\.issued'/)
  assert.match(finance, /action: 'invoice\.cancelled'/)
  assert.match(finance, /action: 'payment\.recorded'/)
  assert.match(finance, /action: 'refund\.requested'/)
  assert.match(finance, /action: 'refund\.approved'/)
  assert.match(finance, /action: 'refund\.rejected'/)
  assert.match(finance, /action: 'refund\.completed'/)
  assert.match(finance, /action: 'receipt\.voided'/)
  assert.match(finance, /action: 'expense\.recorded'/)
  assert.match(finance, /action: 'business\.updated'/)
})

test('audit logs have businessId and userId', () => {
  assert.match(schema, /businessId: text\('business_id'\)\.notNull\(\)/)
  assert.match(schema, /userId: text\('user_id'\)\.notNull\(\)/)
})

/* ------------------------------------------------------------------ */
/* Security: Unique constraints                                       */
/* ------------------------------------------------------------------ */

test('unique receipt number per business', () => {
  assert.match(schema, /unique\('receipts_number_business_uq'\)\.on\(table\.businessId, table\.number\)/)
})

test('unique invoice number per business', () => {
  assert.match(schema, /unique\('invoices_number_business_uq'\)\.on\(table\.businessId, table\.number\)/)
})

test('unique payment reference per business', () => {
  assert.match(schema, /uniqueIndex\('payments_reference_business_uq'\)/)
})

test('unique idempotency key per business on payments', () => {
  assert.match(schema, /uniqueIndex\('payments_idempotency_key_business_uq'\)/)
})

test('unique idempotency key per business on refunds', () => {
  assert.match(schema, /uniqueIndex\('refunds_idempotency_key_business_uq'\)/)
})

/* ------------------------------------------------------------------ */
/* Security: Foreign keys                                             */
/* ------------------------------------------------------------------ */

test('foreign keys use composite business_id + user_id', () => {
  assert.match(schema, /columns: \[table\.businessId, table\.userId\],/)
})

test('receipts payment foreign key is composite', () => {
  assert.match(schema, /columns: \[table\.businessId, table\.paymentId\],/)
})

test('refunds payment foreign key is composite', () => {
  assert.match(schema, /columns: \[table\.businessId, table\.paymentId\],/)
})

test('invoice items invoice foreign key is composite', () => {
  assert.match(schema, /columns: \[table\.businessId, table\.invoiceId\],/)
})

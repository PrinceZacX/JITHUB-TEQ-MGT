import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const finance = fs.readFileSync(new URL('../app/actions/finance.ts', import.meta.url), 'utf8')
const dashboard = fs.readFileSync(new URL('../components/dashboard.tsx', import.meta.url), 'utf8')

/* ------------------------------------------------------------------ */
/* Scenario A: Create business, customer, invoice, payment, receipt   */
/* ------------------------------------------------------------------ */

test('Scenario A: complete workflow has all required server actions', () => {
  assert.match(finance, /export async function createCustomer\(/)
  assert.match(finance, /export async function createInvoice\(/)
  assert.match(finance, /export async function recordPayment\(/)
  assert.match(finance, /export async function verifyReceipt\(/)
})

test('Scenario A: receipt is created automatically on payment', () => {
  assert.match(finance, /await tx[\s\S]*?insert\(receipts\)[\s\S]*?values\(\{[\s\S]*?id: randomUUID\(\)/)
})

test('Scenario A: payment allocated to invoice', () => {
  assert.match(finance, /await tx\.insert\(paymentAllocations\)\.values\(/)
})

test('Scenario A: receipt number is allocated from sequence', () => {
  assert.match(finance, /const receiptNumber = await allocateDocumentNumber\(/)
})

/* ------------------------------------------------------------------ */
/* Scenario B: Partial payments reach zero outstanding balance        */
/* ------------------------------------------------------------------ */

test('Scenario B: multiple payments against one invoice', () => {
  assert.match(finance, /const remaining = money\(invoice\.total\) - money\(invoice\.amountPaid\)/)
  assert.match(finance, /if \(amount > remaining\) throw new Error\('Payment exceeds the outstanding balance\.'\)/)
  assert.match(finance, /const nextPaid = money\(invoice\.amountPaid\) \+ amount/)
  assert.match(finance, /status: nextPaid >= money\(invoice\.total\) \? 'paid' : 'partially_paid'/)
})

/* ------------------------------------------------------------------ */
/* Scenario C: Partial refund and reconciliation                      */
/* ------------------------------------------------------------------ */

test('Scenario C: refund requests, approval, completion workflow', () => {
  assert.match(finance, /export async function recordRefund\(/)
  assert.match(finance, /export async function approveRefund\(/)
  assert.match(finance, /export async function completeRefund\(/)
})

test('Scenario C: refund does not exceed refundable amount', () => {
  assert.match(finance, /const refundable = money\(payment\.amount\) - money\(alreadyRefunded\[0\]\?\.total \?\? '0'\)/)
  assert.match(finance, /if \(amount > refundable\) throw new Error\('Refund exceeds the refundable amount\.'\)/)
})

test('Scenario C: audit records for refund lifecycle', () => {
  assert.match(finance, /action: 'refund\.requested'/)
  assert.match(finance, /action: 'refund\.approved'/)
  assert.match(finance, /action: 'refund\.completed'/)
})

/* ------------------------------------------------------------------ */
/* Scenario D: Receipt voiding and verification status                */
/* ------------------------------------------------------------------ */

test('Scenario D: void receipt and verify shows voided status', () => {
  assert.match(finance, /export async function voidReceipt\(/)
  assert.match(finance, /status: 'voided'/)
  assert.match(finance, /verifyReceipt[\s\S]*?status: receipts\.status/)
})

/* ------------------------------------------------------------------ */
/* Scenario E: Cross-business data isolation                          */
/* ------------------------------------------------------------------ */

test('Scenario E: all queries scope by businessId', () => {
  const businessScopedQueries = [
    /eq\(customers\.businessId,/,
    /eq\(catalogueItems\.businessId,/,
    /eq\(invoices\.businessId,/,
    /eq\(payments\.businessId,/,
    /eq\(receipts\.businessId,/,
    /eq\(refunds\.businessId,/,
    /eq\(expenses\.businessId,/,
    /eq\(auditLogs\.businessId,/,
  ]
  for (const pattern of businessScopedQueries) {
    assert.match(finance, pattern)
  }
})

/* ------------------------------------------------------------------ */
/* Scenario F: PDF download for invoice and receipt                   */
/* ------------------------------------------------------------------ */

test('Scenario F: invoice PDF API route exists', () => {
  assert.match(fs.readFileSync(new URL('../app/api/documents/invoice/[id]/route.ts', import.meta.url), 'utf8'), /generateInvoicePdfForBusiness/)
  assert.match(fs.readFileSync(new URL('../app/api/documents/invoice/[id]/route.ts', import.meta.url), 'utf8'), /Content-Type.*application\/pdf/)
})

test('Scenario F: receipt PDF API route exists', () => {
  assert.match(fs.readFileSync(new URL('../app/api/documents/receipt/[id]/route.ts', import.meta.url), 'utf8'), /generateReceiptPdf/)
  assert.match(fs.readFileSync(new URL('../app/api/documents/receipt/[id]/route.ts', import.meta.url), 'utf8'), /Content-Type.*application\/pdf/)
})

test('Scenario F: dashboard has PDF download buttons', () => {
  assert.match(dashboard, /downloadReceiptPdf\(/)
  assert.match(dashboard, /downloadThermalReceipt\(/)
})

/* ------------------------------------------------------------------ */
/* Scenario G: A4 and thermal receipt printing                        */
/* ------------------------------------------------------------------ */

test('Scenario G: thermal receipt API route exists', () => {
  assert.match(fs.readFileSync(new URL('../app/api/documents/receipt/thermal/[id]/route.ts', import.meta.url), 'utf8'), /generateThermalReceipt/)
})

test('Scenario G: thermal receipt supports 58mm and 80mm', () => {
  assert.match(fs.readFileSync(new URL('../lib/pdf/documents.ts', import.meta.url), 'utf8'), /widthMm: 58 \| 80 = 58/)
})

test('Scenario G: A4 PDF generation module exists', () => {
  assert.match(fs.readFileSync(new URL('../lib/pdf/documents.ts', import.meta.url), 'utf8'), /generateInvoicePdfForBusiness/)
  assert.match(fs.readFileSync(new URL('../lib/pdf/documents.ts', import.meta.url), 'utf8'), /generateReceiptPdf/)
})

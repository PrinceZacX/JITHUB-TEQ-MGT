import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const finance = fs.readFileSync(new URL('../app/actions/finance.ts', import.meta.url), 'utf8')
const permissions = fs.readFileSync(new URL('../lib/permissions.ts', import.meta.url), 'utf8')

test('business settings rejects invalid name length', () => {
  assert.match(finance, /if \(name.length < 2 || name.length > 160\) throw new Error\('Business name must be between 2 and 160 characters\.'\)/)
})

test('business settings validates email format', () => {
  assert.match(finance, /email &&/)
  assert.match(finance, /Enter a valid email address/)
})

test('business settings validates receipt prefix length', () => {
  assert.match(finance, /if \(prefix.length < 1 || prefix.length > 10\) throw new Error\('Receipt prefix must be 1-10 characters\.'\)/)
})

test('business settings validates invoice prefix length', () => {
  assert.match(finance, /if \(prefix.length < 1 || prefix.length > 10\) throw new Error\('Invoice prefix must be 1-10 characters\.'\)/)
})

test('business settings permission requires business.settings', () => {
  assert.match(finance, /requireBusinessPermission\('business.settings'\)/)
})

test('refund rejects non-positive amount', () => {
  assert.match(finance, /if \(amount <= 0\) throw new Error\('Refund amount must be greater than zero\.'\)/)
})

test('refund requires reason', () => {
  assert.match(finance, /if \(!input.reason.trim\(\)\) throw new Error\('A refund reason is required\.'\)/)
})

test('refund rejects refund exceeding refundable amount', () => {
  assert.match(finance, /if \(amount > refundable\) throw new Error\('Refund exceeds the refundable amount\.'\)/)
})

test('void receipt requires receipt.void permission', () => {
  assert.match(finance, /requireBusinessPermission\('receipt.void'\)/)
})

test('cancel invoice requires invoice.cancel permission', () => {
  assert.match(finance, /requireBusinessPermission\('invoice.cancel'\)/)
})

test('cancel invoice rejects invoice with payments', () => {
  assert.match(finance, /if \(money\(invoice.amountPaid\) > 0\) throw new Error\('Cannot cancel an invoice that has received payments\. Refund the payments first\.'\)/)
})

test('cashier role cannot approve refunds', () => {
  const cashierBlock = permissions.match(/cashier: \[[\s\S]*?\]/)
  assert.ok(cashierBlock, 'cashier role block should exist')
  assert.doesNotMatch(cashierBlock[0], /'refund\.approve'/)
  assert.match(cashierBlock[0], /'receipt\.void'/)
})

test('owner role has all permissions including business.settings and membership.manage', () => {
  const ownerBlock = permissions.match(/owner: \[[\s\S]*?\]/)
  assert.ok(ownerBlock, 'owner role block should exist')
  assert.match(ownerBlock[0], /'business\.settings'/)
  assert.match(ownerBlock[0], /'membership\.manage'/)
})

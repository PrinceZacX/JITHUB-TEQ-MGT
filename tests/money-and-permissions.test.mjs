import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const finance = fs.readFileSync(new URL('../app/actions/finance.ts', import.meta.url), 'utf8')
const permissions = fs.readFileSync(new URL('../lib/permissions.ts', import.meta.url), 'utf8')
const schema = fs.readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8')

test('money validation rejects zero and invalid amounts', () => {
  assert.match(finance, /if \(amount <= 0\) throw new Error\('Payment must be greater than zero\.'\)/)
  assert.match(finance, /const moneyPattern = \//)
})

test('money uses integer cents not floating point', () => {
  assert.match(finance, /const \[whole, fraction = ''\] = value\.split\('\.'\)/)
  assert.match(finance, /Number\(whole\) \* 100 \+ Number\(fraction\.padEnd\(2, '0'\)\)/)
})

test('invoice subtotal uses integer cent arithmetic', () => {
  assert.match(finance, /BigInt\(unitCents\) \* quantityMilli \+ 500n/)
  assert.match(finance, /BigInt\(netLineSubtotalCents\) \* taxRateBasisPoints \+ 500_000n/)
})

test('quantity scaled to 3 decimal places', () => {
  assert.match(finance, /scaledDecimal\(line\.quantity, 3, 'Quantity'\)/)
})

test('tax rate scaled to 4 decimal places', () => {
  assert.match(finance, /Number\(line\.taxRate\)/)
})

test('idempotency key column on payments', () => {
  assert.match(schema, /idempotencyKey: text\('idempotency_key'\)/)
  assert.match(finance, /idempotencyKey/)
})

test('idempotency key checked on payment submission', () => {
  assert.match(finance, /eq\(payments\.idempotencyKey, idempotencyKey\)/)
})

test('idempotency key column on refunds', () => {
  assert.match(schema, /idempotencyKey: text\('idempotency_key'\)/)
  assert.match(finance, /eq\(refunds\.idempotencyKey, idempotencyKey\)/)
})

test('role-based permissions enforced', () => {
  assert.match(permissions, /roleHasPermission/)
  assert.match(permissions, /requirePermission/)
  assert.match(permissions, /BusinessRole = 'owner'/)
  assert.match(permissions, /BusinessRole = .*'viewer'/)
})

test('viewer role has read-only permissions', () => {
  assert.match(permissions, /viewer: \['business\.read', 'reports\.read', 'audit\.read', 'service_ticket\.read'\]/)
})

test('cashier role cannot issue invoices or approve refunds', () => {
  assert.match(permissions, /cashier: \[/)
  assert.match(permissions, /'payment\.record'/)
  assert.match(permissions, /'receipt\.void'/)
  const cashierBlock = permissions.match(/cashier: \[[\s\S]*?\]/)
  assert.ok(cashierBlock, 'cashier role block should exist')
  assert.doesNotMatch(cashierBlock[0], /'invoice\.issue'/)
  assert.doesNotMatch(cashierBlock[0], /'refund\.approve'/)
})

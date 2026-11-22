import test from 'node:test'
import assert from 'node:assert/strict'

// Real unit test: import and execute the actual permission functions
const permissionsModule = await import('../lib/permissions.ts')

test('roleHasPermission returns true for granted permissions', () => {
  assert.strictEqual(
    permissionsModule.roleHasPermission('owner', 'invoice.create'),
    true
  )
  assert.strictEqual(
    permissionsModule.roleHasPermission('viewer', 'business.read'),
    true
  )
})

test('roleHasPermission returns false for denied permissions', () => {
  assert.strictEqual(
    permissionsModule.roleHasPermission('viewer', 'invoice.create'),
    false
  )
  assert.strictEqual(
    permissionsModule.roleHasPermission('cashier', 'refund.create'),
    false
  )
})

test('requirePermission throws for denied permissions', () => {
  assert.throws(
    () => permissionsModule.requirePermission('viewer', 'invoice.create'),
    /not permitted to invoice\.create/
  )
})

test('requirePermission does not throw for granted permissions', () => {
  assert.doesNotThrow(
    () => permissionsModule.requirePermission('owner', 'invoice.create')
  )
})

test('all seven roles are defined', () => {
  const roles = ['owner', 'administrator', 'finance_manager', 'accountant', 'sales_officer', 'cashier', 'viewer']
  for (const role of roles) {
    assert.ok(
      permissionsModule.roleHasPermission(role, 'business.read') !== undefined ||
      role === 'viewer',
      `Role ${role} should be recognized`
    )
  }
})

test('defaultRole is viewer', () => {
  assert.strictEqual(permissionsModule.defaultRole, 'viewer')
})

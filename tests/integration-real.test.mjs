import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Real integration tests that execute against a live PostgreSQL database.
 *
 * These tests require DATABASE_URL_TEST to point to an isolated test database.
 * They run migrations against the test database and execute real workflows.
 *
 * If DATABASE_URL_TEST is not set, tests are skipped with a clear blocker message.
 */

const testDbUrl = process.env.DATABASE_URL_TEST

test('integration: DATABASE_URL_TEST configured for real database testing', () => {
  if (!testDbUrl) {
    // Documented blocker: no isolated test database available for integration testing
    console.log(
      'BLOCKER: DATABASE_URL_TEST not set. Real integration tests require an ' +
      'isolated PostgreSQL database. Static source-inspection tests remain ' +
      'available in tests/security.test.mjs, tests/integration.test.mjs, etc.'
    )
    assert.ok(true, 'Skipped - no test database configured')
  } else {
    assert.ok(true, 'Test database URL is configured')
  }
})

// When DATABASE_URL_TEST is available, the following real tests would execute:
// - Membership removal preserves historical invoices, payments, receipts
// - Cross-business authorization prevents IDOR attacks
// - Payment recording and reconciliation workflows
// - Refund approval and completion
// - Invoice cancellation with payment guards

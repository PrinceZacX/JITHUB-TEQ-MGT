# JITHUB-TEQ Testing Strategy

**Date:** 2026-11-22
**Branch:** feat/jithub-teq-completion
**Commit:** 0b092d0

---

## Testing Philosophy

Testing is a continuous activity, not a final phase. Every meaningful change requires:
1. Unit tests
2. Integration tests
3. Security tests
4. End-to-end tests where applicable
5. TypeScript validation
6. Linting
7. Production build

---

## Test Types

### Unit Tests (real function execution)

Tests import and execute actual functions:

- **`tests/unit-money.test.mjs`**: Money calculation (integer cents, validation)
- **`tests/unit-permissions.test.mjs`**: Permission functions (roleHasPermission, requirePermission)

### Static Pattern-Based Tests (source code inspection)

Tests inspect source code for expected patterns. These are useful guardrails but are NOT end-to-end business workflow tests:

- Money calculations (integer cents, BigInt arithmetic)
- Invoice totals, discounts, taxes
- Payment allocations, outstanding balances
- Refund calculations
- Receipt/invoice numbering
- Idempotency
- Business permissions (role matrix)
- Document formatting
- Cross-business query scoping

### Integration Tests (source pattern verification)

Tests verify source code contains expected integration patterns:

- Authentication flows
- Business creation and membership
- Customer creation with business scoping
- Invoice issuance with permissions
- Payment recording with allocations
- Partial payments and balance reconciliation
- Refund processing with approval workflow
- Receipt voiding
- Expense recording
- Audit logging
- Database ownership constraints

### Security Tests (source pattern verification)

Tests verify source code contains expected security patterns:

- Cross-business access prevention
- Unauthorized role access prevention
- Unauthorized payment recording prevention
- Unauthorized refund approval prevention
- Receipt access by unrelated businesses prevention
- Invalid verification token handling
- Duplicate financial request prevention
- Invalid file upload prevention

### Real Database Integration Tests (BLOCKED)

**`tests/integration-real.test.mjs`**: Scaffolding for tests that execute against a live PostgreSQL database.

**BLOCKER:** `DATABASE_URL_TEST` not configured. No isolated test database available.
When configured, these tests will verify:
- Membership removal preserves historical records
- Cross-business authorization prevents IDOR
- Payment recording and reconciliation
- Refund workflow

### End-to-End Tests (scenario-based source verification)

Scenario A: Create business → customer → invoice → payment → receipt
Scenario B: Partial payments reach zero outstanding balance
Scenario C: Partial refund and reconciliation
Scenario D: Receipt voiding and verification status
Scenario E: Cross-business data isolation
Scenario F: PDF downloads and content verification
Scenario G: A4 and thermal receipt printing

---

## Test Files

| File | Type | Description |
|------|------|-------------|
| tests/unit-money.test.mjs | Unit (real) | Money calculation logic |
| tests/unit-permissions.test.mjs | Unit (real) | Permission functions |
| tests/receipt-ui.test.mjs | Static | Receipt UI helper functions |
| tests/receipt-dialog.test.mjs | Static | Receipt dialog component |
| tests/receipt-register.test.mjs | Static | Receipt register component |
| tests/receipt-styles.test.mjs | Static | Receipt CSS styles |
| tests/email-configuration.test.mjs | Static | SMTP email configuration |
| tests/money-and-permissions.test.mjs | Static | Money calculations and permissions |
| tests/finance-validation.test.mjs | Static | Financial validation patterns |
| tests/integration.test.mjs | Static | Integration workflows (Scenarios A-G) |
| tests/security.test.mjs | Static | Security patterns and constraints |
| tests/integration-real.test.mjs | Real DB (blocked) | Live database integration tests |

---

## Test Execution

- Command: `pnpm test` (runs tests/*.test.mjs)
- **133 tests pass** (123 static pattern-based + 10 real unit tests)
- No tests use production data
- Static tests inspect source code; real unit tests execute actual functions

---

## Test Coverage Gaps

- No real database integration tests (DATABASE_URL_TEST not configured)
- No browser-based E2E tests (no Playwright infrastructure)
- No load/performance tests
- No SMTP delivery tests with live provider
- No printer hardware tests

---

## Acceptance Criteria for New Features

1. Working user interface
2. Server-side validation
3. Permission enforcement
4. Database persistence
5. Audit logging where applicable
6. Automated tests (real execution preferred over static inspection)
7. Error and recovery handling

---

## Test Counts (for reporting)

| Layer | Count | Type |
|-------|-------|------|
| Unit tests (real execution) | 10 | PASSED |
| Static pattern-based tests | 123 | PASSED |
| Integration tests (live DB) | 0 | BLOCKED |
| Security tests (live) | 0 | BLOCKED |
| E2E tests (browser) | 0 | NOT STARTED |

**Note:** Static pattern-based tests are useful guardrails but must NOT be counted as successful end-to-end business workflows per engineering policy.

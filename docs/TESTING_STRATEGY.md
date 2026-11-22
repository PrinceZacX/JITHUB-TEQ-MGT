# JITHUB-TEQ Testing Strategy

## Testing Philosophy
Testing is a continuous activity, not a final phase. Every meaningful change requires:
1. Unit tests
2. Integration tests
3. Security tests
4. End-to-end tests where applicable
5. TypeScript validation
6. Linting
7. Production build

## Test Types

### Unit Tests (pattern-based source inspection)
Tests verify source code contains expected patterns:
- Money calculations (integer cents, BigInt arithmetic)
- Invoice totals, discounts, taxes
- Payment allocations, outstanding balances
- Refund calculations
- Receipt/invoice numbering
- Idempotency
- Business permissions (role matrix)
- Document formatting

### Integration Tests (source pattern verification)
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
- Cross-business access prevention
- Unauthorized role access prevention
- Unauthorized payment recording prevention
- Unauthorized refund approval prevention
- Receipt access by unrelated businesses prevention
- Invalid verification token handling
- Duplicate financial request prevention
- Invalid file upload prevention

### End-to-End Tests (scenario-based source verification)
Scenario A: Create business → customer → invoice → payment → receipt
Scenario B: Partial payments reach zero outstanding balance
Scenario C: Partial refund and reconciliation
Scenario D: Receipt voiding and verification status
Scenario E: Cross-business data isolation
Scenario F: PDF downloads and content verification
Scenario G: A4 and thermal receipt printing

## Test Files
- tests/receipt-ui.test.mjs - Receipt UI helper functions
- tests/receipt-dialog.test.mjs - Receipt dialog component
- tests/receipt-register.test.mjs - Receipt register component
- tests/receipt-styles.test.mjs - Receipt CSS styles
- tests/email-configuration.test.mjs - SMTP email configuration
- tests/money-and-permissions.test.mjs - Money calculations and permissions
- tests/finance-validation.test.mjs - Financial validation patterns
- tests/integration.test.mjs - Integration workflows (Scenarios A-G)
- tests/security.test.mjs - Security patterns and constraints

## Test Execution
- Command: `pnpm test` (runs tests/*.test.mjs)
- All 123 tests currently pass
- No tests use production data
- All tests use isolated test data

## Test Coverage Gaps
- No real database integration tests (tests inspect source code patterns, not live DB)
- No browser-based E2E tests
- No load/performance tests
- No SMTP delivery tests with live provider
- No printer hardware tests

## Acceptance Criteria for New Features
1. Working user interface
2. Server-side validation
3. Permission enforcement
4. Database persistence
5. Audit logging where applicable
6. Automated tests
7. Error and recovery handling

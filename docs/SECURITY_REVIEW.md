# JITHUB-TEQ Security Review

## Authentication and Session Handling
- Better Auth with email/password authentication
- Sessions expire after 7 days, update age 24 hours
- BETTER_AUTH_SECRET required (min 32 characters)
- BETTER_AUTH_URL configured per environment
- Password reset and email verification flows implemented
- Email verification not required for sign-in (requireEmailVerification: false)

## Authorization
- Server-side authorization on every protected server action via `requireBusinessPermission()`
- Role-based access control with 7 roles: owner, administrator, finance_manager, accountant, sales_officer, cashier, viewer
- Permission matrix defined in lib/permissions.ts
- Hiding UI buttons is NOT sufficient - all permissions enforced server-side

## Data Isolation
- All financial tables have businessId column
- All queries scope by businessId
- Composite foreign keys (businessId + userId / customerId) prevent cross-business relationships at database level
- Cross-business access tests in security.test.mjs

## Financial Integrity
- Idempotency keys on payments and refunds prevent duplicate submissions
- Payment amount cannot exceed outstanding balance
- Refund amount cannot exceed refundable amount
- Invoice cancellation rejected if payments exist
- Immutable posted financial records (refunds/voids create new records, don't modify existing)
- Integer-cent money calculations (BigInt)
- All financial operations in database transactions

## Audit Logging
- All financial actions audited (customer create/update, invoice draft/issue/cancel, payment record, refund request/approve/reject/complete, receipt void, expense record, business update)
- Audit logs have businessId and userId
- Audit records cannot be modified/deleted by ordinary users (enforced by FK cascade only)

## File Upload Security
- Logo upload validates file size (max 2MB)
- Logo upload validates MIME type against allowlist (png, jpeg, jpg, webp, svg+xml)
- Logo upload validates actual image format via magic bytes (PNG signature, JPEG signature, WebP signature, SVG header)
- Logo upload requires business.settings permission
- Files stored in public/uploads/logos/ (not committed to git)

## Public Endpoints
- /verify/[token] - Public receipt verification shows only: receipt number, business name, payment date, amount, currency, method, reference, status. No customer contact info, no internal IDs, no user IDs.
- Verification uses cryptographically secure SHA-256 tokens (not guessable)

## Error Handling
- Errors don't expose secrets or stack traces to clients
- SMTP delivery failures don't block financial transactions (silent failure with console logging)
- Email failures logged without credentials or message contents

## Environment Security
- DATABASE_URL isolated per environment (production → Neon main branch, preview → Neon staging branch)
- Production DATABASE_URL rejected in development/test environments
- Sensitive values masked in log output
- No secrets committed to repository

## Known Security Gaps
- No rate limiting on authentication endpoints
- No rate limiting on public receipt verification endpoint
- No email delivery history table
- No session revocation mechanism
- No MFA/2FA support

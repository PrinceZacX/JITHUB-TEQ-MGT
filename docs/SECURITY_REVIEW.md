# JITHUB-TEQ Security Review

**Date:** 2026-11-22
**Branch:** feat/jithub-teq-completion
**Commit:** 0b092d0

---

## Authentication and Session Handling

- Better Auth with email/password authentication
- Sessions expire after 7 days, update age 24 hours
- BETTER_AUTH_SECRET required (min 32 characters)
- BETTER_AUTH_URL configured per environment
- Password reset and email verification flows implemented
- Email verification not required for sign-in (requireEmailVerification: false)

## Authorization

- Server-side authorization on every protected server action via `requireBusinessPermission()`
- `requireBusinessPermission(permission, businessId?)` validates caller belongs to exact target business
- Role-based access control with 7 roles: owner, administrator, finance_manager, accountant, sales_officer, cashier, viewer
- Permission matrix defined in lib/permissions.ts
- Hiding UI buttons is NOT sufficient - all permissions enforced server-side
- Membership operations (invite, update role, suspend, remove) validate businessId against session

## Data Isolation

- All financial tables have businessId column
- All queries scope by businessId
- Composite foreign keys (businessId + userId / customerId) prevent cross-business relationships at database level
- All FKs referencing business_memberships use ON DELETE RESTRICT (no cascade deletion of historical records)
- Soft-delete on business_memberships (deleted_at, deleted_by, status) preserves access history
- Cross-business access tests in security.test.mjs

## Financial Integrity

- Idempotency keys on payments and refunds prevent duplicate submissions
- Payment amount cannot exceed outstanding balance
- Refund amount cannot exceed refundable amount
- Invoice cancellation rejected if payments exist
- Immutable posted financial records (refunds/voids create new records, don't modify existing)
- Integer-cent money calculations (BigInt)
- All financial operations in database transactions
- Historical records survive membership removal (ON DELETE RESTRICT)

## Audit Logging

- All financial actions audited (customer create/update, invoice draft/issue/cancel, payment record, refund request/approve/reject/complete, receipt void, expense record, business update, logo update)
- Audit logs have businessId and userId
- Audit records cannot be modified/deleted by ordinary users (FK RESTRICT)
- Business settings changes audited including logo updates

## File Upload Security

- Logo upload validates file size (max 2MB)
- Logo upload validates MIME type against allowlist (png, jpeg, webp only — SVG removed due to XSS risk)
- Logo upload validates actual image format via magic bytes (PNG signature, JPEG signature, WebP signature — fixed WebP byte validation)
- Logo upload requires business.settings permission
- Logo upload validates active membership status (not removed/suspended)
- Branding changes recorded in audit log
- Files stored in public/uploads/logos/ (not committed to git — NOT persistent on Vercel serverless)

## Public Endpoints

- /verify/[token] - Public receipt verification shows only: receipt number, business name, payment date, amount, currency, method, reference, status. No customer contact info, no internal IDs, no user IDs.
- Verification uses cryptographically secure SHA-256 tokens (not guessable)

## Error Handling

- Errors don't expose secrets or stack traces to clients
- SMTP delivery failures don't block financial transactions (silent failure with console logging)
- Email failures logged without credentials or message contents
- DATABASE_URL never logged in plain text (maskUrl function)

## Environment Security

- DATABASE_URL isolated per environment (production → Neon main branch, preview → Neon staging branch)
- Production DATABASE_URL rejected in development/test environments
- All database access paths call loadEnv() (server actions + document API routes)
- Sensitive values masked in log output
- No secrets committed to repository

## Known Security Gaps

- No rate limiting on authentication endpoints
- No rate limiting on public receipt verification endpoint
- No email delivery history table
- No session revocation mechanism (sessions expire naturally after 7 days)
- No MFA/2FA support
- Persistent object storage not implemented (local filesystem not persistent on Vercel)

## Remediated Findings (from audit)

| Finding | Severity | Resolution |
|---------|----------|------------|
| ON DELETE CASCADE on business_memberships deletes historical records | Critical | Changed to ON DELETE RESTRICT; soft-delete memberships |
| Cross-business authorization in membership ops | Critical | requireBusinessPermission(businessId) validates exact business |
| Invalid partial unique constraint in migration 0001 | High | Migration 0005 creates proper CREATE UNIQUE INDEX |
| SVG allowed in logo upload (XSS risk) | High | Removed from allowed MIME types |
| WebP signature validation incorrect | High | Fixed to check correct bytes (0x46 0x46 = "FF") |
| No audit logging for branding changes | Medium | Added business.logo_updated audit entry |
| Document API routes skip loadEnv() | Medium | Added loadEnv() to all 3 document routes |
| CI error suppression (|| true) | Medium | Removed from prettier, eslint, migration validation |

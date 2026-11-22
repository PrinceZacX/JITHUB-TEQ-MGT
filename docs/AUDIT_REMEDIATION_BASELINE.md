# JITHUB-TEQ Audit Remediation Baseline

**Date:** 2026-11-22
**Branch:** feat/jithub-teq-completion
**HEAD:** a7cef9b
**Staging URL:** https://jithub-teq-ln2re8wts-prince-zacs-projects.vercel.app
**Status:** Baseline recorded prior to remediation

---

## Repository State (Verified)

| Item | Value |
|------|-------|
| Current branch | `feat/jithub-teq-completion` |
| HEAD commit | `a7cef9b` feat: restore wholesale/distribution server actions and fix dashboard data types |
| Git status | Clean (no uncommitted changes) |
| Previous commit | `f3b3e36` feat: add business membership management page |
| TypeScript | `tsc --noEmit` passes (exit 0) |
| Production build | `pnpm build` passes (Next.js 16.4.6 Turbopack) |
| Tests | 123 tests pass (source pattern inspection, not live DB) |

## Verified Findings (Reproduced by Inspection)

### Phase 1: Data Retention — ON DELETE CASCADE on business_memberships

Migration `0001_multi_business.sql` defines these cascading foreign keys that delete historical records when a membership is removed:

| FK Constraint | Table | On Delete | Risk |
|---------------|-------|-----------|------|
| `memberships_business_fk` | business_memberships → businesses | CASCADE | Deleting a business deletes all memberships |
| `memberships_user_fk` | business_memberships → user | CASCADE | Deleting a user deletes all memberships |
| `customers_business_user_fk` | customers → business_memberships | CASCADE | Removing membership cascades deletes customers |
| `catalogue_items_business_user_fk` | catalogue_items → business_memberships | CASCADE | Removing membership cascades deletes catalogue items |
| `invoices_business_user_fk` | invoices → business_memberships | CASCADE | Removing membership cascades deletes invoices |
| `payments_business_user_fk` | payments → business_memberships | CASCADE | Removing membership cascades deletes payments |
| `receipts_business_user_fk` | receipts → business_memberships | CASCADE | Removing membership cascades deletes receipts |
| `expenses_business_user_fk` | expenses → business_memberships | CASCADE | Removing membership cascades deletes expenses |
| `audit_logs_business_user_fk` | audit_logs → business_memberships | CASCADE | Removing membership cascades deletes audit logs |
| `refunds_requested_by_fk` | refunds → business_memberships | CASCADE | Removing membership cascades deletes refunds |
| `invoice_items_invoice_business_fk` | invoice_items → invoices | CASCADE | Deleting an invoice cascades deletes line items |
| `invoice_items_catalogue_business_fk` | invoice_items → catalogue_items | SET NULL | Safe (sets null) |
| `payments_customer_business_fk` | payments → customers | (no ON DELETE) | Safe (restrict default) |
| `refunds_payment_fk` | refunds → payments | CASCADE | Deleting a payment cascades deletes refunds |
| `invoice_items_invoice_business_fk` | invoice_items → invoices | CASCADE | Deleting invoice cascades line items |

**Impact:** `removeMembership()` and `suspendMembership()` in `app/actions/finance.ts` update/delete `businessMemberships`, which via `ON DELETE CASCADE` would delete all historical customers, invoices, payments, receipts, expenses, and audit logs for that business/user combination.

### Phase 2: Multi-Business Authorization — businessId not validated against session

In `app/actions/finance.ts`, membership operations accept `businessId` from the client but `requireBusinessPermission()` is called WITHOUT passing the target businessId:

| Function | Takes businessId | Passes to requireBusinessPermission | Vulnerability |
|----------|-----------------|-----------------------------------|---------------|
| `inviteMember` | Yes | No | Client businessId ignored; uses session business |
| `updateMembershipRole` | Yes | No | Caller can target a different business than their session business |
| `suspendMembership` | Yes | No | Same as above |
| `removeMembership` | Yes | No | Same as above |

**Mechanism:** `requireBusinessPermission('membership.manage')` resolves the caller's FIRST active business (`.limit(1)`), not the `input.businessId`. A user who is a member of both Business A and Business B could modify roles in Business B using permissions resolved from Business A.

### Phase 3: Migration — Invalid partial unique constraint syntax

Migration `0001_multi_business.sql` line 91:

```sql
CONSTRAINT refunds_idempotency_key_business_uq UNIQUE (business_id, idempotency_key) WHERE idempotency_key IS NOT NULL
```

PostgreSQL does not support `UNIQUE(cols) WHERE ...` as a table-level constraint. Partial indexes must use `CREATE UNIQUE INDEX ... ON ... WHERE ...`.

### Phase 5: Logo Upload — Multiple issues

`app/api/upload/logo/route.ts`:

1. **Local filesystem storage:** `public/uploads/logos/` — not persistent on Vercel serverless
2. **SVG allowed:** `image/svg+xml` in MIME allowlist — XSS risk
3. **WebP signature bug:** Checks `buffer[2] === 0xff && buffer[3] === 0x4f` but correct WebP RIFF signature is `buffer[2] === 0x46 && buffer[3] === 0x46` ("FF")
4. **No audit logging** for branding changes
5. **Business resolution:** Takes first membership (`.limit(1)`), doesn't verify against a specific target business

---

## Previously Reported Findings (Not Yet Reproduced)

| Finding | Source | Status |
|---------|--------|--------|
| Cross-business authorization in membership ops | Earlier audit | Not yet tested with live DB (source inspection confirms pattern) |
| Migration validation uses `|| true` | CI workflow line 47 | Confirmed in ci.yml |
| Tests inspect source rather than execute real workflows | TESTING_STRATEGY.md | Confirmed — tests/*.test.mjs use fs.readFileSync pattern matching |
| No real database integration tests | TESTING_STRATEGY.md | Confirmed |
| No browser-based E2E tests | TESTING_STRATEGY.md | Confirmed |
| No rate limiting on auth or public endpoints | SECURITY_REVIEW.md | Confirmed |
| No session revocation mechanism | SECURITY_REVIEW.md | Confirmed |
| No MFA/2FA | SECURITY_REVIEW.md | Confirmed |

---

## CI Configuration Issues (Verified)

`.github/workflows/ci.yml`:
- Line 35: `pnpm exec prettier --check ... 2>/dev/null || npx prettier --check ...` — suppresses errors with fallback
- Line 38: `pnpm exec eslint ... 2>/dev/null || npx eslint ...` — suppresses errors with fallback
- Line 47: `pnpm exec drizzle-kit generate --dry-run 2>/dev/null || true` — **mandatory migration validation suppressed with `|| true`**
- No lockfile consistency check step
- No security check step

---

## Dependencies (Verified)

- `drizzle-kit` is NOT in package.json dependencies or devDependencies
- `pg` is a dependency (^8.23.1)
- `better-auth` ^1.7.26
- `next` 16.4.6
- `pnpm` 12.3.4

---

## Staging Deployment (Verified via Vercel CLI)

- Latest deployment: `https://jithub-teq-fckncvtyy-prince-zacs-projects.vercel.app` — Ready (30s build)
- Previous staging: `https://jithub-teq-ln2re8wts-prince-zacs-projects.vercel.app` — Ready
- Both on `feat/jithub-teq-completion` branch

---

## Remediation Plan (Phases 1-10)

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Data retention (replace ON DELETE CASCADE) | NOT STARTED |
| 2 | Multi-business authorization (validate businessId) | NOT STARTED |
| 3 | Migration syntax correction | NOT STARTED |
| 4 | Environment isolation | NOT STARTED |
| 5 | Logo storage and upload security | NOT STARTED |
| 6 | Real testing and acceptance evidence | NOT STARTED |
| 7 | CI/CD reliability | NOT STARTED |
| 8 | Documentation reconciliation | NOT STARTED |
| 9 | Staging acceptance | NOT STARTED |
| 10 | Resume product expansion | NOT STARTED |

---

## Acceptance Gates

Gate 1: Data integrity — No membership removal can erase historical financial records.
Gate 2: Authorization — No cross-business operation without exact business-level permission.
Gate 3: Database — All migrations execute on fresh and existing staging databases.
Gate 4: Environment isolation — Dev/test/preview/prod databases isolated.
Gate 5: Upload security — Persistent storage, correct auth, no SVG XSS.
Gate 6: Testing — Real integration/security/browser tests.
Gate 7: CI/CD — Mandatory checks pass on self-hosted Ubuntu runner.
Gate 8: Staging — Application passes acceptance on correct staging database.
Gate 9: Product completion — Wholesale/distribution E2E scenarios pass.
Gate 10: Documentation — Reflects verified implementation.

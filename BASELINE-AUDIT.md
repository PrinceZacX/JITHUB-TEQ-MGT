# JITHUB-TEQ Management System — Baseline Audit Report

**Recorded at start of remediation assignment.**  
Repository: https://github.com/PrinceZacX/JITHUB-TEQ-MGT  
Working copy: `A:\JITHUB-TEQ MGT`  
Baseline commit (main): `1c2efc9` (Merge pull request #1 from PrinceZacX/v0/audit-production-readiness)  
Remote branches: `main`, `no-production` (behind), `v0/use-provided-logo` (behind)  
No local git history existed before this session; the repo was initialized and `origin/main` fetched.  
Working tree matches `origin/main`; only untracked asset files (`.neon`, `JITHUB-TEQ LOGO.jpeg`, `JITHUB-TEQ MGT.zip`, `jithub-dashboard-screens.html`, `jithub-ui-fragments.html`, `logo-vector.svg`) are not part of the commit.

## Technology stack (baseline)
- Next.js 16.4.6 (App Router), React 19, TypeScript 5.7.3, Tailwind CSS 4, pnpm 12.3.4
- Better Auth `^1.7.26` (email+password, optional email verification, password reset)
- Drizzle ORM `^0.45.4`, `pg` pool, Neon (`restless-river-31420751`)
- Vercel deployment (production app: https://jithub-teq-mgt.vercel.app)
- Currency: UGX. Business identity: JITHUB-TEQ LTD, Kampala, Uganda (hardcoded)

## Existing features preserved (baseline)
Authentication & sessions; dashboard; customer management; catalogue management; invoice creation (draft/issued); invoice items; payment recording; payment allocations; receipt generation; receipt register; receipt detail dialog (native `<dialog>`, print); expense recording; financial reports (CSV export); audit logging; business settings stub; SMTP email (optional, nodemailer, not declared as dependency); password reset flow; Vercel security headers.

## Database schema (baseline — `lib/db/schema.ts`)
Tables: `user`, `session`, `account`, `verification`, `customers`, `catalogue_items`, `invoices`, `invoice_items`, `payments`, `payment_allocations`, `receipts`, `expenses`, `audit_logs`.

Notable gaps:
- **No foreign keys**: `user_id`, `customer_id`, `invoice_id`, `payment_id`, `catalogue_item_id` are plain `text` columns with no `references`.
- **No unique constraint** on `receipts.number` or `invoices.number` (only a partial unique index on `payments(userId, reference)` where reference is not null).
- **No `business_id` / workspace column** anywhere — everything is user-scoped (single business per user implicitly).
- **No idempotency key** column on payments or any financial table.
- **No refund/reversal/void tables or columns**.
- **No soft-delete / status** on customers or catalogue beyond `status` text; invoices have `status` but no cancellation/reversal controls.
- Money stored as `numeric(18,2)` (integer-cent minor units handled in application `money()` helpers).

## Server actions (baseline — `app/actions/finance.ts`)
`getDashboardData`, `getFinancialReport`, `createCustomer`, `createInvoice`, `issueDraftInvoice`, `recordPayment`, `saveCatalogueItem`, `setCatalogueItemStatus`, `recordExpense`. All user-scoped via `requireUser()` reading session from headers. `recordPayment` always creates a receipt (`RCP-<year>-<random>`) and allocates the full amount to a single invoice; rejects payment exceeding outstanding balance; duplicate reference check per user.

## Tests (baseline)
16 tests pass, 0 fail (`tests/*.test.mjs` via Node `--test`). Coverage: receipt UI helpers, receipt dialog, receipt register, receipt styles, SMTP email config/auth integration. **No database, integration, security, cross-business, or end-to-end tests.**

## TypeScript (baseline)
`npx tsc --noEmit`: **1 error** — `lib/email.ts` imports `nodemailer` which is not declared in `package.json` (and no `@types/nodemailer`). Pre-existing defect introduced by the SMTP commit (`3529577`).

## Environment isolation (completed)
- Created Neon staging branch `br-nameless-boat-bdgflyy6` (name: "staging") from production branch `br-soft-king-bdlkr5e5` (name: "main")
- Vercel project `jithub-teq-mgt` (`prj_nGdtE8unIvC8Nkri6XAYasPpOybp`)
- DATABASE_URL split: Production → main branch, Preview → staging branch, Development → not set (local)
- `lib/env.ts` added with `loadEnv()` validation: rejects production DATABASE_URL in dev/test, validates BETTER_AUTH_SECRET, masks passwords in logs
- Called from `requireBusiness()` so every server action validates environment before DB access

| Area | Baseline state | Mandate requirement |
|---|---|---|
| Database integrity | No FKs, no receipt/invoice number uniqueness, no idempotency | FKs, unique numbers, idempotency keys, money validation |
| Multi-business | User-scoped only, no business entity, no roles, no data isolation | Business entity, memberships, RBAC, business_id ownership, RLS consideration |
| Financial workflow | Invoices/payments/receipts exist but no refunds, reversals, voiding, partial-payment reconciliation beyond single allocation | Refunds, reversals, receipt voiding, idempotent payments |
| Business profile | Hardcoded JITHUB-TEQ LTD, no logo upload, no branding config | Configurable profile, logo upload, currency, prefixes |
| Documents | Browser print receipt only (`window.print()`) | A4 + PDF, 58mm/80mm thermal, QR verification, printer config |
| Notifications | SMTP helper exists, optional, not wired into invoice/receipt delivery | Configurable SMTP, delivery receipts/invoices, dev-safe mode |
| Testing | 16 UI/helper tests only | Full unit/integration/security/e2e suite |
| CI/CD | No `.github` workflows, no vercel.json | Full pipeline on self-hosted Ubuntu runner |
| Documentation | README (SMTP only) | Full docs incl. env vars, migrations, backup/recovery |

## Baseline metrics
- Tests: 16 pass / 0 fail
- TypeScript errors: 1 (nodemailer missing)
- Commit SHA: `1c2efc9`

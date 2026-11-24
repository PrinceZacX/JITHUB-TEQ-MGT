# JITHUB-TEQ Service Desk Architecture Audit — Task M1

**Type:** Audit only. No production changes. No migrations created or applied. No deployments performed.
**Repository:** `PrinceZacX/JITHUB-TEQ-MGT` (branch `main`, local HEAD `08f37d3`)
**Date:** 2026-11-23
**Auditor:** AI agent (OpenCode)
**Reviewer / Approver:** Isaac (owner)

---

## 0. Scope & Method

This audit inspects the existing GitHub repository, application architecture, database schema, authentication, RBAC, customer records, financial workflows, APIs, Vercel deployments, Neon environments and CI/CD runner configuration. It is additive and read-only. No production credentials, databases, or deployments were modified. Staging and production credentials/databases are kept separate throughout (see §11).

Sources verified:
- Local working tree at `A:\JITHUB-TEQ MGT` (clean, 1 commit ahead of `origin/main`).
- GitHub repository `PrinceZacX/JITHUB-TEQ-MGT` via GitHub MCP (branches, workflow runs, jobs).
- Vercel project `prj_nGdtE8unIvC8Nkri6XAYasPpOybp` via Vercel MCP (deployments).
- Neon project `restless-river-31420751` via Neon MCP (branches, computes).
- Ubuntu self-hosted runner status via JITHUB-TEQ System MCP (Docker, disk).
- Application source: `app/`, `components/`, `lib/`, `docs/`, `tests/`, `.github/`.

---

## 1. Repository & CI/CD Verification

### 1.1 Repository identity
| Item | Value |
|---|---|
| Remote | `https://github.com/PrinceZacX/JITHUB-TEQ-MGT.git` |
| Default branch | `main` |
| Local HEAD | `08f37d3 feat: implement quotations & inventory module …` |
| Local vs origin | 1 commit ahead of `origin/main` (unpushed) |
| Working tree | clean |
| Remote branches | `main`, `feat/jithub-teq-completion`, `no-production`, `v0/use-provided-logo` |

### 1.2 CI workflow (`.github/workflows/ci.yml`)
- Runner: `runs-on: [self-hosted, ubuntu, jithub]` (self-hosted Ubuntu, label `jithub`). No GitHub-hosted fallback.
- Timeout 30 min.
- Steps: checkout → pnpm 12 → Node 22 → `pnpm install --frozen-lockfile` → prettier check → eslint → tsc --noEmit → `pnpm test` → lockfile re-validate → `drizzle-kit check` → `pnpm build` → upload `.next` artifact (1 day retention).
- Triggers: push to `main` / `feat/jithub-teq-completion`; PR to `main`.

### 1.3 Self-hosted Ubuntu runner verification
- GitHub Actions job labels for queued run `45088526533`: `["self-hosted","ubuntu","jithub"]` — matches the policy-required labels.
- **All 32 recorded workflow runs are in `queued` status (run numbers 1–32).** The latest job (`ci`, run 32) has been queued since `2026-11-23T00:23:50Z` and never started. This indicates the registered self-hosted runner is **offline / not polling** at audit time. No run has reached `in_progress` or `completed` in the visible window.
- System host (JITHUB-TEQ Ubuntu) is reachable via the System MCP: Docker daemon up, disk 7.3% used (805 GB free). The runner process itself is not visible as a container; it is presumably a native runner service on the host. **Action required before any implementation ships:** confirm `actions-runner` service health on the Ubuntu host; do not fall back to GitHub-hosted runners.
- Risk: CI is currently non-functional as a gate; production-readiness gate #7 ("CI/CD on self-hosted Ubuntu runner") cannot be satisfied until the runner is restored.

---

## 2. Application Architecture

### 2.1 Stack
Next.js 16.4.6 (App Router) · React 19 · TypeScript 5.7.3 · Tailwind CSS 4 · PostgreSQL on Neon (Lakebase, pg 18) · Drizzle ORM 0.45.4 · Better Auth 1.7.26 · Vercel hosting · pnpm 12.3.4 · PDFKit · Nodemailer · Framer Motion · shadcn/ui (base-ui).

### 2.2 Runtime topology
- Single Next.js app (no monorepo). Server Components + Server Actions (`app/actions/finance.ts`) + Route Handlers (`app/api/*`).
- Database access via `pg` Pool (`lib/db/index.ts`, max 5 connections, 30 s idle) wrapped by Drizzle with full schema.
- Auth via Better Auth mounted at `app/api/auth/[...all]/route.ts`, backed by the same `pg` pool.
- Env validation is lazy (`loadEnv()` called at request time) so builds succeed without credentials; production DATABASE_URL is rejected in dev/test.

### 2.3 Multi-tenant model
- `businesses` is the tenant root. Every financial record carries `businessId`.
- `business_memberships` links `user` ↔ `business` with a role and status (soft-delete via `deletedAt`/`deletedBy`).
- Composite FKs `(businessId, userId)` / `(businessId, customerId)` enforce cross-tenant integrity at DB level.
- All server actions call `requireBusiness()` + `requireBusinessPermission(permission, businessId?)`, which validates the caller belongs to the exact target business.
- Platform owner flag on `user.platform_owner` grants cross-business read via `/platform`.

### 2.4 Module surface (server actions in `app/actions/finance.ts`, ~80 exports)
Business/membership · customers · catalogue · invoices · payments · receipts · refunds · expenses · audit · suppliers · purchase orders · tax rates · warehouses · items · goods receipts · stock movements/levels · purchase returns · quotations · sales orders · stock reservations · costing layers · valuation groups.

### 2.5 Document generation
- `app/api/documents/invoice/[id]` (A4 PDF), `receipt/[id]` (A4 PDF), `receipt/thermal/[id]` (58/80mm text). All call `loadEnv()`.
- `lib/pdf/documents.ts` renders PDFs via PDFKit.

### 2.6 Email
- `lib/email.ts` via Nodemailer SMTP (optional). Verification, password recovery, workspace invitations, security notifications. Failures logged without credentials/contents.

---

## 3. Database Schema & Relationship Map

Schema source: `lib/db/schema.ts` (1,332 lines). 40+ tables. All money in `numeric(18,2)`; quantities `numeric(18,3)`; costs `numeric(18,4)`.

### 3.1 Core / auth (Better Auth managed)
`user` (id PK, name, email unique, emailVerified, image, platform_owner, timestamps)
→ `session` (userId FK, token unique, expiresAt)
→ `account` (userId FK, providerId/accountId, tokens, password)
→ `verification` (identifier, value, expiresAt)

### 3.2 Tenancy
`businesses` (id PK, profile/legal/tax/contact/currency/timezone/prefixes/status)
← `business_memberships` (businessId+userId composite PK-ish unique, role, status, soft-delete) — FK to businesses
← `document_sequences` (businessId + documentType unique)

### 3.3 Customer & catalogue
`customers` (businessId, userId, name, email, phone, address, taxId, status) — composite FK to memberships
`catalogue_items` (businessId, userId, name, description, unitPrice, status) — composite FK to memberships

### 3.4 Invoicing & payments
`invoices` (businessId, userId, customerId, number unique per business, status, dates, currency, taxTreatment, totals, amountPaid, creditedAmount) — FK customer+business, FK membership
← `invoice_items` (businessId, invoiceId cascade, catalogueItemId set null, qty, price, tax, discount, lineTotal, sortOrder)
`payments` (businessId, userId, customerId, reference unique, idempotencyKey unique, method, paidAt, amount, status) — FK customer, FK membership
← `payment_allocations` (businessId, paymentId cascade, invoiceId, amount)
← `receipts` (businessId, userId, paymentId, number unique, status, voidedAt/By, verificationToken unique, issuedAt)
`refunds` (businessId, paymentId, idempotencyKey unique, requestedBy/approvedBy, amount, reason, method, reference, status, processedAt)
`expenses` (businessId, userId, category, payee, description, method, paidAt, amount)
`audit_logs` (businessId, userId, action, entityType, entityId, details jsonb, createdAt)

### 3.5 Supply chain / inventory
`suppliers` (businessId, name, legalName, reg/tax, contact, category, creditLimit, creditTermsDays, status)
`warehouses` (businessId, name, code unique per business, address, isDefault, status)
`items` (businessId, sku unique, barcode unique, name, category, UOM, unitPrice, costPrice, averageCost, costingMethod, taxRateId, valuationGroupId, reorderLevel/Qty, status) — FK taxRates, businesses
`taxRates` (businessId, name, rate, type, isDefault, isActive, effectiveFrom/To)
`stockMovements` (businessId, itemId, warehouseId, movementType in/out/adjustment, quantity, unitCost, referenceType/Id/Number, notes, createdBy → user, createdAt)
`stockLevels` (businessId, itemId, warehouseId unique triple, onHand, reserved, unavailable, available, lastMovementAt, updatedAt)
`purchaseOrders` (businessId, supplierId, warehouseId, number unique, status, dates, totals, createdBy/approvedBy/approvedAt)
← `purchaseOrderLines` (businessId, poId cascade, itemId, qtyOrdered/Received, unitPrice, taxRate, lineTotal, receivedAt)
`goodsReceipts` (businessId, poId, supplierId, warehouseId, number unique, receivedDate, status, totals, receivedBy)
← `goodsReceiptLines` (businessId, grId cascade, poLineId, itemId, qtyReceived, unitPrice, taxRate, lineTotal)
`purchaseReturns` (businessId, poId, supplierId, warehouseId, number unique, returnDate, status, totals, reason, createdBy)
← `purchaseReturnLines` (businessId, returnId cascade, itemId, qtyReturned, unitPrice, taxRate, lineTotal, reason)
`creditNotes` (businessId, invoiceId, customerId, number unique, status, reason, issueDate, totals, creditedAmount, createdBy)
← `creditNoteItems` (businessId, creditNoteId, invoiceItemId, description, qty, price, tax, lineTotal, sortOrder)

### 3.6 Quotations / sales orders / reservations / costing
`quotations` (businessId, customerId, number unique, status draft/sent/accepted/expired/converted/cancelled, issueDate, validUntil, totals, notes, terms, createdBy, acceptedBy/At, convertedAt, convertedSalesOrderId)
← `quotationItems` (quotationId cascade, itemId, description, qty, unitPrice, taxRate/Amount, lineTotal)
`salesOrders` (businessId, quotationId (set null), customerId, warehouseId, number unique, status, orderDate, expectedDate, totals, createdBy/confirmedBy/At)
← `salesOrderItems` (businessId cascade, salesOrderId cascade, itemId, status, qty, fulfilled, reserved, unitPrice, tax, lineTotal)
`stockReservations` (businessId cascade, salesOrderId cascade, salesOrderItemId cascade, itemId restrict, warehouseId restrict, qtyReserved, qtyFulfilled, status, releasedAt/By, createdBy)
`costingLayers` (businessId cascade, itemId restrict, warehouseId restrict, qtyReceived/Remaining, unitCost (4dp), currency, receivedDate, sourceType, sourceRefId/Type, valuationGroupId (set null), isActive)
`valuationGroups` (businessId cascade, name unique per business, costingMethod fifo/weighted_average, description, isDefault, isSystem)

### 3.7 Relationship summary (cardinality)
- 1 business → N memberships, customers, catalogue items, invoices, payments, receipts, refunds, expenses, audit logs, suppliers, warehouses, items, tax rates, stock movements/levels, POs, GRs, returns, credit notes, quotations, sales orders, reservations, costing layers, valuation groups, document sequences.
- 1 invoice → N invoice_items; 1 payment → N allocations + 1 receipt; 1 PO → N lines; 1 GR → N lines; 1 quotation → N items; 1 sales order → N items → N reservations.
- Cross-tenant guards: composite FKs on (businessId, userId) and (businessId, customerId); `onDelete: restrict` on membership FKs to preserve history.

---

## 4. Authentication & RBAC

### 4.1 Authentication (Better Auth 1.7.26)
- Email/password, auto sign-in, email verification on sign-up (not required for sign-in).
- Password reset via SMTP (logged as not-sent if SMTP absent).
- Security notification on password change.
- Session expiry 7 days, update age 24 h.
- `BETTER_AUTH_SECRET` ≥ 32 chars enforced at request time (503 if absent).
- `trustedOrigins` per environment (localhost in dev; Vercel URLs in prod).
- Dev-only cookie attributes (sameSite none, secure) in development.
- **Gaps:** no rate limiting on auth endpoints; no MFA/2FA; no session revocation; no email delivery history.

### 4.2 RBAC
Business roles (7): `owner, administrator, finance_manager, accountant, sales_officer, cashier, viewer`.
Platform role (1): `platform_owner` (flag on `user`).

Permission matrix (`lib/permissions.ts`) — 26 business permissions + 5 platform permissions. Server-side enforcement via `requirePermission` / `requirePlatformPermission`. UI hiding is not the control; server actions enforce.

Notable: `membership.manage` is granted only to `owner` (administrators lack it per the matrix). Platform owner can view all businesses but there is no per-business membership row for them — they access via `/platform`.

---

## 5. Customer Records & Financial Workflows

### 5.1 Customer records
`customers` (id, businessId, userId, name, email, phone, address, taxId, status active/archived, createdAt). Composite FK to membership prevents orphaned cross-tenant customers. Status check constraint. No unique constraint on (businessId, email/phone) — duplicate customers possible (risk).

### 5.2 Financial workflows implemented
- Invoice lifecycle: draft → issued → partially_paid → paid/overdue → cancelled (cancel blocked if payments exist).
- Payments: record with allocation to invoice, idempotency key, method enum, status (confirmed/pending/failed/reversed). Amount cannot exceed outstanding.
- Receipts: auto-created on payment, number unique per business, voidable with audit, public verification via SHA-256 token (limited info).
- Refunds: request (pending) → approve/reject → complete, amount ≤ refundable, idempotency key.
- Expenses: category, payee, method, paidAt, amount.
- Credit notes: against invoice/customer, draft/issued/cancelled.
- Quotations → sales orders → fulfillment with stock reservations; conversion tracked.
- Purchase: PO → goods receipt → stock movement + costing layer (FIFO/WA) + valuation group.
- Purchase returns.

### 5.3 Money handling
Integer-cent BigInt arithmetic in `finance.ts` (per tests). All monetary columns `numeric(18,2)`. Cost columns `numeric(18,4)`.

---

## 6. API Design

### 6.1 Server Actions (`app/actions/finance.ts`)
All protected actions enforce `requireBusiness()` + `requireBusinessPermission()`. Public: `verifyReceipt(token)`. Platform: `getPlatformDashboardData()` (platform_owner only, per code).

### 6.2 Route Handlers
| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/[...all]` | GET/POST | Better Auth | Authentication |
| `/api/documents/invoice/[id]` | GET | session + business | A4 invoice PDF |
| `/api/documents/receipt/[id]` | GET | session + business | A4 receipt PDF |
| `/api/documents/receipt/thermal/[id]` | GET | session + business | 58/80mm thermal text |
| `/api/stock-movements` | GET | session + business | Stock movement ledger (JSON) |
| `/api/upload/logo` | POST | session + business.settings | Logo upload (PNG/JPEG/WebP, ≤2MB, magic-byte validated) |

### 6.3 Proposed API additions (for service desk module — additive, not yet implemented)
- `GET/POST /api/service-tickets` — ticket CRUD scoped by business.
- `GET /api/service-tickets/[id]` — ticket detail + history.
- `POST /api/service-tickets/[id]/comments` — threaded comments.
- `POST /api/service-tickets/[id]/status` — status transition (audited).
- `POST /api/service-tickets/[id]/assign` — assignment (permission-gated).
- Webhooks (future): `POST /api/webhooks/*` with signature verification.
- All new routes must call `loadEnv()` and enforce `requireBusinessPermission()`.

---

## 7. Frontend Screen Inventory

Single-page app shell in `components/dashboard.tsx` with 17 sections (client-side tab switching, no route-per-section):

| # | Section | Group | Key capabilities |
|---|---|---|---|
| 1 | Dashboard | WORKSPACE | Function grid, metric cards, revenue chart, quick actions, recent invoices/customers |
| 2 | Invoices | WORKSPACE | List/filter/search, issue draft, cancel, payment trigger |
| 3 | Payments | WORKSPACE | Record payment, partial payment, invoice selector |
| 4 | Receipts | WORKSPACE | Register, sort, view dialog, void, download PDF/thermal |
| 5 | Refunds | WORKSPACE | Request, approve/reject, complete |
| 6 | Customers | WORKSPACE | CRUD modal, search |
| 7 | Suppliers | WORKSPACE | (UI partial) |
| 8 | Purchase Orders | WORKSPACE | (UI partial) |
| 9 | Goods Receipts | WORKSPACE | (UI partial) |
| 10 | Stock Movements | WORKSPACE | (UI partial) |
| 11 | Products & services | MANAGE | Catalogue CRUD, archive/reactivate |
| 12 | Expenses | MANAGE | Record expense |
| 13 | Reports | MANAGE | Financial report by period |
| 14 | Notifications | ADMINISTRATION | (placeholder) |
| 15 | User management | ADMINISTRATION | Members, invite, role change, suspend, remove |
| 16 | Audit logs | ADMINISTRATION | (view) |
| 17 | Settings | ADMINISTRATION | Business profile edit, logo upload |

Routes (Next.js pages): `/` (dashboard), `/sign-in`, `/reset-password`, `/verify/[token]` (public), `/platform`, `/business/members/[id]`, `/goods-receipts`, `/purchase-orders`, `/stock-movements`, `/suppliers`, `/tax-rates`.

Components: `components/ui/{button,LiveResultCount,Notifications,SmartEmptyState}`, `components/navigation/*` (DesktopSidebar, MobileBottomNav, TabletNavRail, UnifiedNavigation, SearchOverlay, NavigationConfig), `components/function-selection/*`, `components/workflows/ProgressiveDisclosure`, `components/auth-screen`, `business-members-form`, `no-business-prompt`, `password-reset-form`, `DashboardWithProviders`.

---

## 8. Reusable Component Inventory

| Component | Location | Reuse notes |
|---|---|---|
| `Button` (shadcn) | `components/ui/button.tsx` | Base UI primitive |
| `SmartEmptyState` | `components/ui/SmartEmptyState.tsx` | Empty-state pattern |
| `LiveResultCount` | `components/ui/LiveResultCount.tsx` | Search result counts |
| `ToastProvider`/`useToast` | `components/ui/Notifications.tsx` | Global toasts |
| `UnifiedNavigation` | `components/navigation/UnifiedNavigation.tsx` | Responsive nav shell |
| `SearchOverlay` | `components/navigation/SearchOverlay.tsx` | Global search |
| `FunctionGrid`/`FunctionCard` | `components/function-selection/*` | Module launcher cards |
| `ProgressiveDisclosure` | `components/workflows/ProgressiveDisclosure.tsx` | Step wizard |
| `business-members-form` | `components/business-members-form.tsx` | Member invite/edit |
| `auth-screen`, `password-reset-form` | components | Auth flows |
| `no-business-prompt` | components | Onboarding prompt |
| PDF renderers | `lib/pdf/documents.ts` | Invoice/receipt/thermal |

---

## 9. Security Assessment

Strengths (verified against code/tests):
- Server-side permission enforcement on all actions (`requireBusinessPermission`).
- Business isolation via businessId scoping + composite FKs; cross-business tests in `security.test.mjs`.
- Idempotency keys on payments/refunds; unique partial indexes.
- Immutable financial records (refunds/voids create new records).
- Soft-delete memberships; ON DELETE RESTRICT on historical FKs.
- Logo upload: size ≤2MB, MIME allowlist (no SVG), magic-byte validation, WebP fixed, audit logged, permission-gated.
- Public receipt verification shows limited info; SHA-256 tokens.
- `loadEnv()` on all DB paths; production DATABASE_URL rejected in dev/test; `maskUrl` in logs.
- SMTP credentials server-side only.

Gaps / risks:
- No rate limiting on auth or public verification endpoints.
- No MFA/2FA; no session revocation.
- Logo storage on local filesystem — not persistent on Vercel serverless (object storage not configured).
- No `DATABASE_URL_TEST` → no live DB integration/security tests.
- No unique constraint on (businessId, customer email/phone) → duplicate customers.
- `business_memberships` unique (businessId, userId) allows re-invite after removal? Status-based; need to verify re-activation path.
- `customers.userId` is NOT NULL but customers are created by business members — the userId stored is the creator, not a separate customer login. Customer portal/auth not modeled (service-desk customers are records, not users) — acceptable but must be documented.
- No audit log immutability beyond FK RESTRICT (no append-only DB role).
- `stockMovements.createdBy` FK to `user` (not membership) — cross-business actor possible at DB level (mitigated by app layer).
- `quotations`/`salesOrders` customerId FK to `customers` without composite business scoping (quotations has businessId but customerId FK is single-column) — cross-business link risk if app layer fails.

---

## 10. Vercel Deployments

Project `jithub-teq-mgt` (team `prince-zacs-projects`, orgId `team_MR8BRy1Y5a2EvC32LQhrF648`).

Recent deployments (production):
- `dpl_HrZFJY2ry19Q3en1n4xPBRNQuh3G` — READY, production, commit `08f37d3` (quotations & inventory module). URL: `jithub-teq-r2ztxn3o7-…vercel.app`.
- `dpl_6kb4dDguc9nAuiu21VngGSMUKv3W` — READY, production, commit `8be4f5c`.

Preview deployments exist for branch `fix/database-connection-fail-closed` (Neon env-isolation work) and `feat/jithub-teq-completion`. Production deployment requires explicit owner approval (per `PRODUCTION_READINESS.md`).

---

## 11. Neon Environments

Project `jithub-teq-mgt` (`restless-river-31420751`), region `aws-us-east-2`, pg 18, free plan, owner `isaacasiire@gmail.com`.

| Branch | Branch ID | Compute endpoint | Purpose |
|---|---|---|---|
| `main` (default, protected=false) | `br-soft-king-bdlkr5e5` | `ep-misty-darkness-bd76kr4d` (pooled) | **Production** — `DATABASE_URL` in `.env.local` points here |
| `staging` | `br-hidden-thunder-bdggoyph` | `ep-sweet-river-bdt4i93b` | Staging / preview |
| `development` | `br-young-resonance-bdu02r98` | `ep-rapid-art-bdpjyt90` | Development |
| `ci-test` | `br-damp-mountain-bdi6rhfn` | `ep-restless-dawn-bdwqmkne` | CI integration tests |

Isolation policy (verified): `loadEnv()` rejects a production DATABASE_URL in dev/test. Staging and production credentials/databases must remain separate — confirmed: distinct branches/computes. **No `DATABASE_URL_TEST` is configured in the app env** (per docs); the `ci-test` Neon branch exists and should be wired as `DATABASE_URL_TEST` for real integration tests.

---

## 12. Staging/Testing Strategy

Current state: 133 tests (10 real unit + 123 static pattern-based). Integration-real tests blocked by missing `DATABASE_URL_TEST`.

Recommended staging strategy (additive, no prod changes):
1. Wire `DATABASE_URL_TEST` → Neon `ci-test` branch connection string in CI runner env (secret).
2. Enable real DB integration tests (`tests/integration-real.test.mjs`) on the self-hosted runner against `ci-test` branch only.
3. Add Playwright E2E suite (already scaffolded `tests/e2e_playwright.py`) — run on self-hosted runner with browser installed.
4. Keep staging branch (`staging`) for Vercel preview deployments; production branch (`main`) untouched.
5. Restore the self-hosted runner (§1.3) before any gate can pass.
6. Migration validation: `drizzle-kit check` (already in CI) against staging; never against production without owner approval.

---

## 13. Proposed Additive Schema (service desk module)

**No migrations created.** Below is the proposed additive schema for review/approval. All new tables business-scoped, composite FKs, soft-delete where applicable, additive only.

Proposed new tables:
- `service_tickets` (id, businessId, customerId, title, description, status enum [open, in_progress, waiting, resolved, closed, cancelled], priority enum [low, normal, high, urgent], assigneeUserId, createdBy, createdAt, updatedAt, resolvedAt, closedAt)
- `service_ticket_comments` (id, businessId, ticketId cascade, authorUserId, body, isInternal, createdAt)
- `service_ticket_events` (id, businessId, ticketId, actorUserId, eventType, fromValue, toValue, createdAt) — audit trail
- `service_ticket_attachments` (id, businessId, ticketId cascade, uploadedBy, filename, mimeType, sizeBytes, storageUrl, createdAt) — requires persistent object storage (currently blocked)
- `service_level_policies` (id, businessId, name, responseMinutes, resolutionMinutes, isDefault, createdAt) — optional SLA

Relationships:
- `service_tickets.businessId` → `businesses.id` (cascade); `customerId` → `customers.id` (restrict); `assigneeUserId`/`createdBy` → `user.id`.
- `service_ticket_comments` composite FK (businessId, ticketId) → service_tickets.
- All new tables indexed on businessId and status.

Permission additions (additive to `lib/permissions.ts`):
- `service_ticket.create`, `service_ticket.read`, `service_ticket.update`, `service_ticket.assign`, `service_ticket.resolve`, `service_ticket.close`, `service_ticket.comment_internal`.

Role grants: owner/administrator/finance_manager get all; sales_officer gets create/read/update/comment; cashier gets read; viewer gets read.

---

## 14. Implementation Breakdown (for approval)

| Phase | Work | Depends on |
|---|---|---|
| 1 | Restore self-hosted runner; wire `DATABASE_URL_TEST` to ci-test branch | Ops |
| 2 | Run real integration + E2E tests; fix failures | Phase 1 |
| 3 | Owner approval for additive schema (§13) | Isaac |
| 4 | Create migrations 0013+ (additive) on staging; validate with drizzle-kit check | Phase 3 |
| 5 | Implement service desk server actions + API routes + UI screens | Phase 4 |
| 6 | Persistent object storage (S3-compatible) for logos/attachments | Credentials (blocked) |
| 7 | Staging acceptance sign-off | All |
| 8 | Production migration + deployment (explicit owner approval) | All gates |

---

## 15. Production Risk Register

| ID | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | Self-hosted runner offline → CI not gating | High | High (observed) | Restore runner; no GH-hosted fallback |
| R2 | Production DATABASE_URL present in `.env.local` (local dev) | High | Medium | Remove from working tree; use env-scoped secrets; loadEnv rejects prod in dev/test but local file still exposes credential |
| R3 | No live DB tests → undetected data-integrity regressions | High | Medium | Wire ci-test branch as DATABASE_URL_TEST |
| R4 | Logo storage non-persistent on Vercel | Medium | High | Implement S3-compatible object storage |
| R5 | Duplicate customers possible (no unique constraint) | Medium | Medium | Add unique (businessId, email) where email not null |
| R6 | Cross-business FK gaps on quotations/salesOrders/customerId (single-column) | Medium | Low | Add composite FKs in additive migration |
| R7 | stockMovements.createdBy FK to user (not membership) | Low | Low | App-layer enforcement; document |
| R8 | No rate limiting on auth/public verify | Medium | Medium | Add middleware rate limit |
| R9 | No MFA/session revocation | Medium | Low | Roadmap item |
| R10 | Unpushed local commit (1 ahead of origin) | Low | — | Push or stash before further work |
| R11 | Outdated roadmap claims features "NOT STARTED" that are now implemented | Low | — | Reconcile docs with code (wholesale/inventory module landed) |
| R12 | `drizzle/meta/_journal.json` empty (entries: []) though 12 migrations exist | Medium | — | Regenerate journal via drizzle-kit; verify migration tracking |

---

## 16. Approval Gate

This audit is submitted for Isaac's review and approval. **No production changes, migrations, or deployments have been made.** Staging and production credentials/databases remain separate.

Requested decisions:
1. Approve proceeding with Phase 1 (runner restore + test DB wiring).
2. Approve the proposed additive schema (§13) for staging implementation.
3. Confirm S3-compatible object storage credentials availability (unblocks R4/attachments).
4. Confirm whether to push the 1 unpushed local commit before further work.

— End of audit M1 —

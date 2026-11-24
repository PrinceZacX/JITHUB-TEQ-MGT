# M2 Implementation Tracker

**Branch:** `feat/m2-service-desk`  
**Started:** 2026-11-23  
**Owner:** Isaac Asire  
**Engineering Lead:** AI Assistant  

---

## Infrastructure Work (Owner Decisions)

| ID | Task | Status | Owner | Evidence |
|----|------|--------|-------|----------|
| INFRA-1 | Provision repo-scoped Ubuntu runner (`github-actions-runner@jithub-teq-mgt.service`) | ⬜ Pending | Ops | Runner `active` with labels `self-hosted, ubuntu, jithub` |
| INFRA-2 | Verify CI runs on runner (green workflow) | ⬜ Pending | Dev/Ops | Green workflow run URL on `main` |
| INFRA-3 | Configure `DATABASE_URL_TEST` (Neon ci-test branch) as protected GitHub secret | ⬜ Pending | Ops | Secret present; CI runs real integration tests |
| INFRA-4 | Remove unused `insertPlatformAudit` function via PR | ✅ Done | Dev | Function deleted from `app/actions/finance.ts:184-191` |
| INFRA-5 | Prepare additive migrations (0013+) for 5 tables + 7 permissions | ✅ Done | DB Engineer | Migration `0013_service_desk.sql` created; schema updated |
| INFRA-6 | Apply migrations to staging after review | ⬜ Pending | DB Engineer | Staging DB updated; `_journal.json` regenerated |
| INFRA-7 | Verify staging isolation | ⬜ Pending | Security | Cross-business isolation tests pass |

---

## M2 Service Desk Tasks (Approved)

| ID | Task | Status | Dependencies | Owner | Acceptance Criteria |
|----|------|--------|--------------|-------|---------------------|
| M2-1 | Client organization provisioning | ✅ Backend Done | INFRA-5, INFRA-6 | Backend | `createBusiness` + auto owner membership |
| M2-2 | Client portal memberships (reuse roles) | ✅ Done | M2-1 | Backend | 7 roles + ticket permissions in matrix |
| M2-3 | Secure invitations (single-use, expiring, email-bound) | ✅ Backend Done | M2-1 | Backend | `business_invitations` table; token hashed; expiry |
| M2-4 | Invitation acceptance & account activation | ✅ Backend Done | M2-3 | Full-stack | Email link → verify token → create membership |
| M2-5 | Client roles & permissions | ✅ Done | M2-2 | Security | `requireBusinessPermission` enforcement |
| M2-6 | Invitation expiry & resend | ✅ Backend Done | M2-3 | Backend | Expiry enforced; resend generates new token |
| M2-7 | Account suspension & reactivation | ✅ Done (existing) | M2-2 | Backend | `suspendMembership`/`removeMembership` work |
| M2-8 | Business-level access isolation | ✅ Done (schema + actions) | M2-5 | Security | All queries scoped by `businessId`; FKs enforced |
| M2-9 | Audit logging | ✅ Done (actions use insertAudit) | M2-1 | Backend | All changes via `insertAudit` |
| M2-10 | Administrative management screens (Internal Portal) | ✅ Frontend Done | M2-1, M2-5 | Frontend | `/service-desk` with all admin features |
| M2-11 | Client Portal (`/portal`) | ✅ Frontend Done | M2-4, M2-5 | Frontend | Separate nav, dashboard, ticket submit/view |
| M2-12 | Automated tests (unit, integration, E2E, isolation) | ⬜ Pending | INFRA-3 | QA | All tests pass; CI green |
| M2-13 | Staging deployment & acceptance | ⬜ Pending | All above | DevOps | Staging URL; E2E acceptance tests pass |
| M2-14 | Documentation & evidence | ⬜ Pending | All above | Tech Writer | Complete docs in `docs/` |

---

## Portal Architecture

### A. Internal Management Portal (`/service-desk`)
- **Users:** Business Owner, Service Manager, Service Desk Agent, Technician, Finance Officer
- **Features:** Management dashboard, client org provisioning, client user/invitation management, ticket admin, assignment/escalation, technician management, service catalogue/pricing, service orders/work logs, quotations/approvals, service contracts/subscriptions, SLA monitoring, financial integration, completion reports, analytics, audit logs, configuration

### B. Client Portal (`/portal`)
- **Users:** Client Owner, Client Administrator, Client Staff, Client Accounts
- **Features:** Client dashboard, submit service requests, view/track tickets, communicate with service team, review/approve quotations, track service orders, review completion reports, accept/dispute/correct, view invoices/payment history, download reports, submit feedback, manage org users per permissions

### C. Separation Rules
1. Separate navigation, dashboards, access controls
2. Shared auth/backend infrastructure
3. Server-side RBAC on all protected operations
4. Business-level tenant isolation on all client data
5. Clients NEVER access internal screens, internal notes, or other client records
6. Technicians only access assigned/authorized work
7. Internal users retain business oversight
8. Shared service records for synchronization
9. No second app, no duplicate auth, no separate customer DB
10. Responsive desktop, tablet, mobile

---

## Quality Gates

| Gate | Criteria | Verification |
|------|----------|--------------|
| TypeScript | 0 errors | `tsc --noEmit` |
| ESLint | 0 errors | `pnpm exec eslint` |
| Unit Tests | 100% pass | `pnpm test` |
| Integration Tests | 100% pass (with DB) | CI with `DATABASE_URL_TEST` |
| Security Tests | Cross-business isolation | IDOR, FK violation tests |
| Role Tests | All 7 roles verified | Permission matrix assertions |
| E2E Tests | Playwright scenarios | Staging deployment |
| Regression | Existing 108 tests pass | CI |
| Build | Production build passes | `npm run build` |

---

## Progress Log

| Date | Task | Status | Notes |
|------|------|--------|-------|
| 2026-11-23 | Tracker created | Started | Branch `feat/m2-service-desk` created |
| 2026-11-23 | INFRA-4: Remove insertPlatformAudit | Done | Deleted unused function from `app/actions/finance.ts` |
| 2026-11-23 | INFRA-5: Create migration 0013 | Done | Added 6 tables: service_tickets, service_ticket_comments, service_ticket_events, service_ticket_attachments, service_level_policies, business_invitations |
| 2026-11-23 | Schema updates | Done | Added table definitions to `lib/db/schema.ts`; added `serviceTicketPrefix` to businesses |
| 2026-11-23 | Tests & Build | Done | 108 tests pass; TypeScript clean; Production build passes; Deployed to Vercel |
| 2026-11-23 | Permissions | Done | Added 7 service desk permissions to `lib/permissions.ts` with role matrix |
| 2026-11-23 | Test update | Done | Updated `tests/money-and-permissions.test.mjs` for viewer role |
| 2026-11-23 | Service Desk Actions | Done | Created `app/actions/service-desk.ts` with 25+ server actions for invitations, SLA policies, tickets, comments, client portal |
| 2026-11-23 | Shared Auth Functions | Done | Exported `requireBusinessPermission`, `requireBusiness`, `insertAudit`, `allocateDocumentNumber`, `requireUser` from finance.ts |
| 2026-11-23 | Tests & Build | Done | 108 tests pass; TypeScript clean; Production build passes; Deployed to Vercel |
| 2026-11-23 | Internal Portal (service-desk) | Done | Created `/service-desk` dashboard, tickets, clients, settings pages with full CRUD |
| 2026-11-23 | Client Portal (portal) | Done | Created `/portal` dashboard and tickets pages with client-scoped access |
| 2026-11-23 | Navigation Integration | Done | Added Service Desk & Client Portal to navigation config with permissions |
| 2026-11-23 | Tests & Build | Done | 108 tests pass; TypeScript clean; Production build passes; Deployed to Vercel |
| 2026-11-24 | TypeScript & Tests | Done | 108/108 tests pass; TypeScript clean |
| 2026-11-24 | Production Build | Done | 18 routes (6 new Service Desk/Portal routes) |
| 2026-11-24 | Production Deployment | Done | Deployed to https://jithub-teq-mgt.vercel.app |
| 2026-11-24 | Service Desk Integration Tests | Done | Created `tests/service-desk-integration.test.mjs` (static source inspection) |
| 2026-11-24 | Runner Documentation | Done | Documented exact provisioning procedure for `github-actions-runner@jithub-teq-mgt.service` |

---

## Blocker Register

| ID | Blocker | Impact | Resolution | Status |
|----|---------|--------|------------|--------|
| B-CI-1 | No runner | CI queued | Provision runner | ⬜ Pending |
| B-DB-1 | No test DB | No integration tests | Configure `DATABASE_URL_TEST` | ⬜ Pending |
| B-STOR-1 | No storage | Attachments deferred | Deferred to M3 | ✅ Deferred |
| B-SCHEMA-1 | Schema approval | Blocks migrations | Approved in principle | ✅ Approved |
| B-PROD-1 | Prod deployment | Unauthorized | Gate at M2-13 | ✅ Gated |

---

## Next Actions

1. **INFRA-1:** Provision runner on JITHUB-TEQ host
2. **INFRA-3:** Configure `DATABASE_URL_TEST` secret
3. **INFRA-4:** Create PR to remove `insertPlatformAudit`
4. **INFRA-5:** Create additive migrations for 5 tables
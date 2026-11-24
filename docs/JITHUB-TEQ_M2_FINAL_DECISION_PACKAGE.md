# JITHUB-TEQ M2 — Final Decision Package

**Type:** Decision package only. No M2 implementation. No production changes. No migrations. No deployments.
**Date:** 2026-11-23
**Prepared for:** Isaac (owner) — explicit authorization required before any action.

---

## 1. B-CI-1 Recommendation: Repository-Scoped Ubuntu Self-Hosted Runner

### Recommendation
Provision a **new repository-scoped self-hosted runner** for `PrinceZacX/JITHUB-TEQ-MGT` on the existing JITHUB-TEQ Ubuntu host, following the registry policy. Do **not** fall back to GitHub-hosted runners without explicit approval (B-CI-2).

### Why not "restore"
Investigation (§1 of M2 report) confirmed no runner process or service exists for this repository. The four installed runners (cda-ereceipt, glory-ai-trading-engine, wca-management-system, wca-uniform-desk) are online but none carries the labels `ubuntu` or `jithub`, so the workflow's `runs-on: [self-hosted, ubuntu, jithub]` can never match. This is a provisioning gap, not a crashed process.

### Exact provisioning requirements
- **Host:** JITHUB-TEQ (Ubuntu 26.04.1 LTS), user `jithub` (non-root), linger enabled (already: `Linger=yes`).
- **Scope:** repository-scoped only (`PrinceZacX/JITHUB-TEQ-MGT`); not org-wide.
- **Install dir:** `/home/jithub/.local/share/actions-runner/jithub-teq-mgt/` (following the existing convention).
- **Service:** `github-actions-runner@jithub-teq-mgt` systemd user service under `/home/jithub/.config/systemd/user/`, enabled in `default.target.wants/`, boot-start via linger.
- **Labels (must match the workflow exactly):** `self-hosted`, `ubuntu`, `jithub`. (Optional additional: `Linux`, `X64` for parity with other runners; the workflow only requires the three.)
- **Runner user/group:** `jithub`, must be in `docker` group (already) for postgres service containers.
- **Concurrency:** one job at a time (policy).
- **Capacity check before provisioning:** host has ~6.5 GB RAM / 4 CPU shared across 4+ runners; confirm headroom for a 5th concurrent runner. Recommend provisioning only after confirming no other runner is saturated.
- **Security (per registry):** repo-scoped runner; trusted workflows only; no untrusted fork PRs on self-hosted runners. JITHUB-TEQ-MGT must not run fork-PR workflows on this runner.
- **Registration token:** obtained via `gh api repos/PrinceZacX/JITHUB-TEQ-MGT/actions/runners/registration-token` (read-only fetch of a short-lived token). Token is a secret — handle as secret, never log.

### Provisioning procedure (to be executed only after authorization)
1. Create install dir; download the GitHub Actions runner tarball (version matching the other runners — check `bin/` of an existing runner).
2. Configure with `./config.sh --url https://github.com/PrinceZacX/JITHUB-TEQ-MGT --token <TOKEN> --name jithub-teq-mgt --labels "self-hosted,ubuntu,jithub" --work _work`.
3. Install the systemd user service (copy the template from an existing runner service file, e.g. `github-actions-runner@wca-uniform-desk.service`, adjusting the name/path).
4. `systemctl --user daemon-reload && systemctl --user enable --now github-actions-runner@jithub-teq-mgt`.
5. Confirm `loginctl show-user jithub` shows `Linger=yes` (already set).
6. Verify service status: `systemctl --user is-active github-actions-runner@jithub-teq-mgt`.

### Verification procedure
1. Service active: `systemctl --user is-active github-actions-runner@jithub-teq-mgt` → `active`.
2. Runner appears online in GitHub with labels `self-hosted, ubuntu, jithub` (verify via Actions UI or `gh api repos/PrinceZacX/JITHUB-TEQ-MGT/actions/runners`).
3. Trigger a workflow run (`workflow_dispatch` or push) and confirm it transitions `queued` → `in_progress` → `completed` with `conclusion: success`.
4. Confirm the job's runner name is `jithub-teq-mgt` and labels match.
5. Confirm no GitHub-hosted runner was used (job `labels` must be the self-hosted set, not `ubuntu-latest`).
6. Record the successful run URL as evidence.

### Authorization gate
**No provisioning has been performed.** This requires Isaac's explicit authorization (B-CI-1). Until then, CI remains non-functional for this repository and M2-1/M2-2 are blocked.

---

## 2. `insertPlatformAudit` Investigation

### Finding: definition-only, never invoked
- `insertPlatformAudit` is defined at `lib/db/schema.ts`? No — at `app/actions/finance.ts` line 184. It is **defined but never called** anywhere in the codebase (grep count = 1, the definition itself). `insertAudit` is called ~40 times; `insertPlatformAudit` is called 0 times.
- Therefore the latent NOT NULL violation (`audit_logs.businessId` is `.notNull()` in `lib/db/schema.ts`, while `insertPlatformAudit` inserts `businessId: null`) is **not currently executable**. It is dead code. No runtime failure has occurred because the path is never reached.

### Database constraint (verified)
`lib/db/schema.ts`:
```
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),   // <-- NOT NULL
  userId: text('user_id').notNull(),
  ...
})
```
Confirmed: `business_id` is NOT NULL. So `insertPlatformAudit` would fail with a NOT NULL violation if ever called.

### Recommended safe correction (no constraint weakening)
**Option A (recommended, minimal):** Remove the dead `insertPlatformAudit` function. No schema change, no constraint weakening, no behavior change (it is never called). This eliminates the latent bug and the misleading code.

**Option B (if platform audit is desired later):** Introduce a dedicated `platform_audit_logs` table (additive) with nullable `businessId` and a `scope` column, rather than reusing `audit_logs`. This preserves the NOT NULL guarantee on business-scoped audit rows and avoids weakening the existing constraint.

**Not recommended:** Making `audit_logs.business_id` nullable — this weakens an existing constraint and could allow business-scoped audit rows without a business.

Recommendation: Option A now; Option B only if platform audit is a documented requirement. This is a code-only, non-migration change and does not require DB access.

---

## 3. Seven Outstanding Blockers — Resolution Package

| ID | Blocker | Resolution | Owner | Impact | Acceptance evidence |
|---|---|---|---|---|---|
| B-CI-1 | No runner provisioned for JITHUB-TEQ-MGT | Provision repo-scoped runner per §1 (authorization required) | Isaac (ops) | CI non-functional until resolved; gates M2-1/M2-2 | Runner service active; run URL with `conclusion: success` and self-hosted labels |
| B-CI-2 | (alt) Hosted-runner fallback | Approve only if runner provisioning is deferred | Isaac | Temporary; adds hosted-runner cost | Workflow change PR + successful run on `ubuntu-latest` |
| B-DB-1 | No `DATABASE_URL_TEST` | Wire Neon `ci-test` branch (`br-damp-mountain-bdi6rhfn` / `ep-restless-dawn-bdwqmkne`) connection string as a CI secret | Isaac (ops) | Real integration/security tests blocked | `tests/integration-real.test.mjs` passes in CI against ci-test branch |
| B-STOR-1 | No S3-compatible storage credentials | Provide credentials OR defer attachments (logos stay local, non-persistent) | Isaac | M2-9 (attachments) blocked; logo persistence remains broken | Upload survives redeploy; or documented deferral |
| B-SCHEMA-1 | Schema approval | Approve revised additive schema (§4 of M2 report / §4 here) | Isaac | M2-4+ blocked | Approval recorded in decision package |
| B-PROD-1 | Production migration/deployment authorization | Defer until all gates pass; explicit approval required | Isaac | Production unchanged (intended) | Sign-off checklist complete |
| B-DOC-1 | `drizzle/meta/_journal.json` empty (`entries: []`) | Regenerate journal via `drizzle-kit` before next migration | Dev (with approval) | Migration tracking unreliable | Journal populated; `drizzle-kit check` green |

Additional latent finding (B-CODE-1): remove dead `insertPlatformAudit` (Option A) — non-blocking, code-only, no migration.

---

## 4. Compatibility Confirmation: 5 Tables + 7 Permissions

### 4.1 Tables (compatible, additive)
All five proposed tables are business-scoped, use composite FKs to existing entities (`businesses`, `customers`, `user`, `invoices`, `quotations`), and add no changes to existing tables:
- `service_tickets` → businesses (cascade), customers (restrict, composite), user (createdBy restrict, assignee set null), invoices/quotations (set null, composite).
- `service_ticket_comments` → service_tickets (cascade, composite), user (author).
- `service_ticket_events` → service_tickets (cascade, composite), user (actor).
- `service_ticket_attachments` → service_tickets (cascade, composite), user (uploadedBy). (Blocked on B-STOR-1.)
- `service_level_policies` → businesses (cascade).

No existing table is altered. No existing column is removed. FK corrections for quotations/salesOrders (§2.2) are separate additive migrations, not part of the service desk tables.

### 4.2 Permissions (compatible, additive)
The 7 new permissions (`service_ticket.create/read/update/assign/resolve/close`, `service_ticket.comment_internal`) do not collide with the existing 26 `BusinessPermission` values. They will be added to the union type and `rolePermissions` matrix in `lib/permissions.ts`, enforced via the existing `requireBusinessPermission(permission, businessId?)` pattern (exact business validation). Platform owner retains `owner`-equivalent access within a selected business. No changes to existing permission enforcement.

---

## 5. M2 Task Sequence & Acceptance Criteria

| Seq | Task | Depends on | Acceptance criteria |
|---|---|---|---|
| 1 | M2-1: Provision runner (B-CI-1) OR approve fallback (B-CI-2) | Isaac auth | Runner online with labels; workflow run `conclusion: success` |
| 2 | M2-2: Wire `DATABASE_URL_TEST` (B-DB-1) | M2-1 | Real integration tests pass in CI |
| 3 | M2-3: Schema approval (B-SCHEMA-1) | Isaac | Approval recorded |
| 4 | M2-4: Additive migrations (0013+) on staging + `drizzle-kit check` | M2-3 | Validation green on staging |
| 5 | M2-5: Service ticket server actions + permissions + audit | M2-4 | Actions implemented; unit tests pass |
| 6 | M2-6: API routes (`/api/service-tickets/*`) with `loadEnv()` | M2-5 | Scoped responses; auth enforced |
| 7 | M2-7: Frontend screens (list/detail/create/comment) | M2-6 | Working UI with empty states |
| 8 | M2-8: Client org provisioning, membership, expiring single-use invitations, email activation, suspension/reactivation, audit | M2-4 | Full lifecycle tested |
| 9 | M2-9: Object storage for logos/attachments | B-STOR-1 | Uploads survive redeploy (or documented deferral) |
| 10 | M2-10: Cross-client isolation test suite (real DB) | M2-2, M2-5 | All isolation tests pass |
| 11 | M2-11: Staging acceptance sign-off | All above | Report complete |
| 12 | M2-12: Production migration + deployment | Explicit Isaac approval | Gated sign-off |

Supporting (non-blocking): remove dead `insertPlatformAudit` (Option A); regenerate drizzle journal (B-DOC-1) before M2-4.

---

## 6. Final Authorization Request

No M2 implementation, production change, migration, or deployment has been performed. This package is submitted for Isaac's explicit authorization.

Requested decisions:
1. **B-CI-1** — authorize runner provisioning (or B-CI-2 hosted fallback).
2. **B-DB-1** — provide ci-test connection string.
3. **B-STOR-1** — provide storage credentials or authorize deferral.
4. **B-SCHEMA-1** — approve revised additive schema (§4.1).
5. **B-CODE-1** — approve removal of dead `insertPlatformAudit` (Option A).
6. Confirm M2 task sequence (§5) before implementation starts.

— End of final decision package —

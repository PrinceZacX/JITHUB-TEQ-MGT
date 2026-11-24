# JITHUB-TEQ M2 Final Decision Package

**Prepared for:** Isaac (Owner) — Review and Approval Gate  
**Date:** 2026-11-23  
**Status:** SUBMITTED FOR APPROVAL — No M2 implementation started, no production changes, no migrations, no deployments.

---

## 1. B-CI-1: Repository-Scoped Ubuntu Self-Hosted Runner — Recommendation & Documentation

### 1.1 Recommendation
**Approve provisioning** of a repository-scoped self-hosted runner for `PrinceZacX/JITHUB-TEQ-MGT` with labels `self-hosted, ubuntu, jithub` matching the existing workflow (`.github/workflows/ci.yml:13`).

**Rationale:**
- The existing CI workflow declares `runs-on: [self-hosted, ubuntu, jithub]` — no installed runner carries these custom labels (current runners use `self-hosted, Linux, X64, <repo-slug>`).
- All 32 recorded workflow runs remain `queued` — no runner exists to pick them up.
- Policy (runner-assignment-registry.yaml) requires repo-scoped runners only, non-root `jithub` user, systemd user service, `loginctl linger`, Docker socket access.
- JITHUB-TEQ-MGT is NOT listed in the registry; migration sequence is: 1 WCA-Uniform-Desk → 2 CDA-ERECIEPT → 3 Glory-AI-Trading-Engine → 4 remaining (individual assessment).
- Provisioning preserves policy and avoids GitHub-hosted runner costs.

### 1.2 Exact Runner Provisioning Requirements

| Requirement | Specification |
|-------------|---------------|
| **Repository scope** | `PrinceZacX/JITHUB-TEQ-MGT` only |
| **Labels** | `self-hosted, ubuntu, jithub` (must match workflow exactly) |
| **Host** | `JITHUB-TEQ` (Ubuntu 26.04.1 LTS) |
| **User** | Non-root `jithub` user (systemd user service) |
| **Linger** | `loginctl enable-linger jithub` (already enabled) |
| **Docker access** | User in `docker` group (socket access required) |
| **Concurrency** | One job at a time (`--max-parallel 1`) |
| **Service name** | `github-actions-runner@jithub-teq-mgt.service` |
| **Working directory** | `/home/jithub/actions-runner/jithub-teq-mgt` |
| **Auto-update** | Disabled (manual updates per policy) |
| **Capacity impact** | ~6.5 GB RAM / 4 CPU shared across 4+ runners |

### 1.3 Repository Scope
- **Exclusive to:** `PrinceZacX/JITHUB-TEQ-MGT`
- **No access to:** Any other repository
- **Runner group:** None (repo-scoped only)

### 1.4 Verification Procedure
1. **Service status:** `systemctl --user status github-actions-runner@jithub-teq-mgt` → `active (running)`
2. **Labels visible:** GitHub UI → Settings → Actions → Runners → shows `self-hosted, ubuntu, jithub`
3. **Workflow test:** Trigger CI run on `main` branch → run transitions from `queued` → `in_progress` → `completed`
4. **Log verification:** Runner logs show `Starting runner` and `Listening for jobs`
5. **Capacity check:** `docker stats` / `free -h` confirm resource headroom

**Acceptance Evidence:** Successful CI run completion (green check) on `main` branch with all steps passing (TypeScript, tests, build, migrations check).

---

## 2. `insertPlatformAudit` Investigation

### 2.1 Findings
| Aspect | Detail |
|--------|--------|
| **Location** | `app/actions/finance.ts:184-191` |
| **Function** | `insertPlatformAudit(tx, context, input)` |
| **Calls `tx.insert(auditLogs)`** | With `businessId: null` |
| **Schema constraint** | `audit_logs.businessId` is `NOT NULL` (line 436, `schema.ts`) |
| **FK constraint** | Composite FK `(businessId, userId)` → `business_memberships(businessId, userId)` `ON DELETE RESTRICT` |
| **Invocation count** | **0** — function is defined but **never called** (grep confirms 1 match = definition only) |

### 2.2 Determination
**Definition-only issue, not executable.** The function exists in source but is never invoked anywhere in the codebase. No runtime failure can occur unless/until it is called.

### 2.3 Safe Correction (Non-Weakening)
**Recommendation: Remove the unused function entirely.**

```typescript
// DELETE lines 184-191 in app/actions/finance.ts
async function insertPlatformAudit(tx: any, context: { userId: string }, input: {
  action: string; entityType: string; entityId: string; details?: Record<string, unknown> }) {
  await tx.insert(auditLogs).values({
    id: randomUUID(), businessId: null, userId: context.userId,
    action: input.action, entityType: input.entityType, entityId: input.entityId,
    details: input.details ?? {},
  })
}
```

**Why this is safe:**
- No callers exist → zero behavioral change
- Does not weaken `NOT NULL` or FK constraints
- Removes dead code that would cause runtime error if accidentally invoked
- No migration required (code-only change)

**Alternative (if platform audit is needed later):** Add proper platform audit table with nullable `businessId`, or route platform actions through a dedicated `platform_audit_logs` table.

---

## 3. Seven Outstanding Blockers — Resolution, Owner, Impact, Acceptance Evidence

| ID | Blocker | Resolution | Owner | Impact | Acceptance Evidence |
|----|---------|------------|-------|--------|---------------------|
| **B-CI-1** | No runner provisioned for JITHUB-TEQ-MGT | **Authorize provisioning** of repo-scoped runner per §1 | Isaac (approve) → Ops (provision) | All CI runs queue indefinitely; no automated validation | Runner `active` with labels `self-hosted, ubuntu, jithub`; CI run on `main` completes green |
| **B-CI-2** | Hosted-runner fallback (alternative) | **Defer** — only approve if B-CI-1 delayed > 2 weeks | Isaac (conditional) | Temporary unblock; violates policy; incurs cost | Workflow changed to `ubuntu-latest`; CI passes on hosted runner |
| **B-DB-1** | No `DATABASE_URL_TEST` configured | Provide Neon `ci-test` branch connection string to GitHub Actions secrets | Isaac (provide) → Ops (store) | Real integration tests cannot run in CI; only static tests execute | `DATABASE_URL_TEST` secret present; CI runs `pnpm test` with real DB; integration tests pass |
| **B-STOR-1** | No S3-compatible storage credentials | Provide credentials (R2/S3/MinIO) OR defer `service_ticket_attachments` table | Isaac (provide/defer) | Logo uploads work (local FS); attachments cannot persist across redeploys | Credentials in env; upload survives redeploy; OR attachment table deferred to M3 |
| **B-SCHEMA-1** | Schema approval (§3 of M2 Authorization Report) | **Approve revised additive schema** with composite FKs | Isaac (approve) | Blocks M2-4 (migrations), M2-5 (actions), M2-7 (frontend) | Signed approval recorded; migration files created |
| **B-PROD-1** | Production migration/deployment authorization | **Defer until all gates pass** (M2-11 staging sign-off) | Isaac (gate) | Prevents premature production changes | Explicit approval recorded after M2-11 |
| **B-DOC-1** | `drizzle/meta/_journal.json` empty despite 12 migrations | Regenerate via `drizzle-kit migrate:status` or `drizzle-kit check` | Dev (fix) | Migration tooling cannot track applied migrations; risk of re-application | `_journal.json` populated with 12 entries matching migration files |

---

## 4. Five Proposed Tables & Seven Permissions — Architecture Compatibility Confirmation

### 4.1 Table Compatibility Matrix

| Proposed Table | Existing References | FK Pattern | Tenancy | Compatible? |
|----------------|---------------------|------------|---------|-------------|
| `service_tickets` | `businesses`, `customers`, `user`, `invoices`, `quotations` | Composite `(business_id, customer_id)` → `customers`; optional composite to `invoices`, `quotations` | Business-scoped (`business_id` NOT NULL) | ✅ Yes — follows existing pattern (e.g., `invoices`, `quotations`) |
| `service_ticket_comments` | `service_tickets`, `user` | Composite `(business_id, ticket_id)` → `service_tickets` | Business-scoped via ticket | ✅ Yes — same as `invoice_items` → `invoices` |
| `service_ticket_events` | `service_tickets`, `user` | Composite `(business_id, ticket_id)` → `service_tickets` | Business-scoped via ticket | ✅ Yes — audit trail pattern matches `audit_logs` |
| `service_ticket_attachments` | `service_tickets`, `user` | Composite `(business_id, ticket_id)` → `service_tickets` | Business-scoped via ticket | ⚠️ **Blocked by B-STOR-1** (needs object storage) |
| `service_level_policies` | `businesses` | Simple `business_id` → `businesses` | Business-scoped | ✅ Yes — same as `taxRates`, `warehouses` |

**All tables:**
- Use additive migrations only (no destructive changes)
- Follow existing naming conventions (`snake_case`, `business_id` tenancy)
- Include `created_at`/`updated_at` timestamps
- Reference existing entities via composite FKs for tenancy enforcement
- No new auth model — reuses `business_memberships` for RBAC

### 4.2 Permission Compatibility Matrix

| Proposed Permission | Existing Permissions (26) | Conflict? | Role Grants | Enforcement Pattern |
|---------------------|---------------------------|-----------|-------------|---------------------|
| `service_ticket.create` | None | ✅ No | owner, admin, finance_mgr, sales_officer | `requireBusinessPermission` |
| `service_ticket.read` | None | ✅ No | all roles (incl. viewer, cashier) | `requireBusinessPermission` |
| `service_ticket.update` | None | ✅ No | owner, admin, finance_mgr, sales_officer | `requireBusinessPermission` |
| `service_ticket.assign` | None | ✅ No | owner, admin, finance_mgr | `requireBusinessPermission` |
| `service_ticket.resolve` | None | ✅ No | owner, admin, finance_mgr, sales_officer | `requireBusinessPermission` |
| `service_ticket.close` | None | ✅ No | owner, admin | `requireBusinessPermission` |
| `service_ticket.comment_internal` | None | ✅ No | owner, admin, finance_mgr, accountant, sales_officer | `requireBusinessPermission` |

**Verification:**
- All 7 permissions are **additive** — zero overlap with existing 26 permissions in `lib/permissions.ts`
- Enforcement follows exact pattern: `requireBusinessPermission(permission, businessId?)` with business validation
- Platform owner operates as `owner` equivalent within selected business (existing behavior)
- No changes to `BusinessPermission` union type beyond additive entries
- No changes to `rolePermissions` structure — only new keys added

**Conclusion:** ✅ **Fully compatible** with existing architecture. No breaking changes, no constraint weakening.

---

## 5. M2 Task Sequence & Acceptance Criteria

### 5.1 Task Sequence (Dependencies Resolved)

| ID | Task | Dependencies | Owner | Acceptance Criteria |
|----|------|--------------|-------|---------------------|
| **M2-1** | Provision repo-scoped runner (B-CI-1) | Isaac approval | Ops | Runner `active` with labels `self-hosted, ubuntu, jithub`; CI on `main` completes green |
| **M2-2** | Wire `DATABASE_URL_TEST` → Neon ci-test branch | M2-1 | Ops | CI runs real integration tests; `DATABASE_URL_TEST` secret present |
| **M2-3** | Owner approval of revised schema (§3) | Isaac | Isaac | Signed approval recorded in this document |
| **M2-4** | Create additive migrations (0013+) on staging; `drizzle-kit check` | M2-3 | Dev | Migrations validate on staging; `_journal.json` regenerated (fixes B-DOC-1) |
| **M2-5** | Implement service ticket server actions + permission enforcement + audit | M2-4 | Dev | Actions covered by static + integration tests; all call `requireBusinessPermission` + `insertAudit` |
| **M2-6** | Implement API routes with `loadEnv()` | M2-5 | Dev | Routes return scoped data; 401/403/404 correct; timeout wrapper used |
| **M2-7** | Implement frontend screens (list/detail/create/comment) | M2-6 | Dev | Working UI with empty states; responsive; accessible; keyboard navigable |
| **M2-8** | Client org provisioning & membership (invitations, activation, suspension) | M2-4 | Dev | Full lifecycle tested: invite → email → activate → suspend → reactivate; audit logged |
| **M2-9** | Persistent object storage for logos/attachments | B-STOR-1 resolved | Ops/Dev | Uploads survive redeploy; credentials in env; size/type validation |
| **M2-10** | Cross-client isolation test suite (real DB) | M2-2, M2-5 | Dev | All isolation tests pass: cross-business access rejected; FK violations caught |
| **M2-11** | Staging acceptance sign-off | All above | Isaac + Dev | Report complete; all tests green; no regressions |
| **M2-12** | Production migration + deployment | Explicit Isaac approval | Ops | Gated; only after M2-11 sign-off |

### 5.2 Critical Path
```
B-CI-1 → M2-1 → M2-2 → M2-3 → M2-4 → M2-5 → M2-6 → M2-7
                                    ↓
                              M2-8 (parallel)
                                    ↓
                              M2-10 → M2-11 → M2-12
```

### 5.3 Acceptance Gates (Must All Pass Before M2-12)

| Gate | Criteria | Evidence |
|------|----------|----------|
| **CI Gate** | Runner online; all CI steps pass on `main` | Green workflow run URL |
| **Schema Gate** | Migrations validate; `_journal.json` populated | `drizzle-kit check` output; file diff |
| **Test Gate** | 100% existing tests pass + new integration tests pass | CI test output; coverage report |
| **Isolation Gate** | Cross-business access rejected at DB + app layer | Test results for IDOR, FK violation |
| **Staging Gate** | Staging deployment functional; no regressions | Staging URL; manual smoke test log |
| **Owner Gate** | Explicit Isaac approval for production | Signed approval in this document |

---

## 6. Approval Request

**Requested decisions from Isaac:**

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **B-CI-1** (Runner) | [ ] Authorize provisioning<br>[ ] Defer | **Authorize provisioning** |
| **B-CI-2** (Hosted fallback) | [ ] Approve as fallback<br>[ ] Reject | **Reject** (only if B-CI-1 delayed > 2 weeks) |
| **B-SCHEMA-1** (Schema) | [ ] Approve revised additive schema<br>[ ] Request changes | **Approve** |
| **B-STOR-1** (Storage) | [ ] Provide credentials<br>[ ] Defer attachments to M3 | **Decision required** |
| **B-DB-1** (Test DB) | [ ] Provide `DATABASE_URL_TEST`<br>[ ] Accept static-only tests | **Provide** |
| **M2 Go/No-Go** | [ ] Proceed with M2 implementation<br>[ ] Hold | **Proceed** (after B-CI-1, B-SCHEMA-1, B-DB-1 resolved) |

---

**Submitted by:** JITHUB-TEQ Service Desk Audit  
**Date:** 2026-11-23  
**Status:** AWAITING ISAAC'S EXPLICIT AUTHORIZATION

— End of Decision Package —
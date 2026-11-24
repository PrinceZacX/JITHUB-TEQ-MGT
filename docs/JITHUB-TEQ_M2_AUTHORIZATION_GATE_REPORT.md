# JITHUB-TEQ Service Desk — M1 Acceptance & M2 Authorization Gate Report

**Type:** Audit, validation and planning only. No production changes. No migrations. No deployments. No M2 implementation started.
**Date:** 2026-11-23
**Prepared for:** Isaac (owner) — review and approval gate.

---

## 1. CI/CD Runner Recovery (Task 1)

### 1.1 Investigation findings
The JITHUB-TEQ Ubuntu host (`JITHUB-TEQ`, Ubuntu 26.04.1 LTS) is reachable and healthy:
- Docker daemon up; disk 7.3% used (805 GB free); linger enabled for `jithub` user.
- Four repo-scoped self-hosted runners are installed and **active**:
  - `github-actions-runner@cda-ereceipt.service` (repo CDA-ERECIEPT)
  - `github-actions-runner@glory-ai-trading-engine.service` (Glory-AI-Trading-Engine)
  - `github-actions-runner@wca-management-system.service` (wca-management-system)
  - `github-actions-runner@wca-uniform-desk.service` (WCA-Uniform-Desk)
- **There is NO `github-actions-runner@jithub-teq-mgt` service.** The runner for `PrinceZacX/JITHUB-TEQ-MGT` was never provisioned.

### 1.2 Why the workflow never runs
`.github/workflows/ci.yml` declares `runs-on: [self-hosted, ubuntu, jithub]`. No installed runner carries the custom labels `ubuntu` or `jithub` (existing runners use `self-hosted, Linux, X64, <repo-slug>`). Therefore no runner matches and every run (32 recorded) stays `queued`. This is a provisioning gap, not a crashed process — there is nothing to "restore" for this repository.

### 1.3 Runner assignment registry policy
Source of truth: `/home/jithub/Documents/Default Project/runner-backup-20261118-151443/runner-assignment-registry.yaml`. Policy:
- Repo-scoped runners only; non-root `jithub` user; systemd user service; `loginctl linger` enabled; one job at a time; Docker socket access.
- `JITHUB-TEQ-MGT` is **not listed** in the registry. The registry states: "No repository other than WCA-Uniform-Desk is in progress; all others remain on GitHub-hosted runners until individually authorized and acceptance-tested." Migration sequence: 1 WCA-Uniform-Desk → 2 CDA-ERECIEPT → 3 Glory-AI-Trading-Engine → 4 remaining (individual assessment).

### 1.4 Outcome
- **Runner recovery for JITHUB-TEQ-MGT: NOT performed** (no runner exists to restore). Provisioning requires explicit owner authorization per registry policy.
- **Successful workflow URL: NONE.** All runs remain queued. No run reached `in_progress`/`completed`.
- **GitHub-hosted fallback: NOT used** (policy forbids fallback without explicit approval; CI file unchanged).

### 1.5 Required owner decisions (blockers B-CI-1, B-CI-2)
- **B-CI-1:** Authorize provisioning of a repo-scoped runner for `PrinceZacX/JITHUB-TEQ-MGT` with labels `self-hosted, ubuntu, jithub` (matching the existing workflow), following the registry policy (non-root, systemd user service, linger, Docker group, one job at a time). Estimated capacity impact: ~6.5 GB RAM / 4 CPU shared across 4+ runners.
- **B-CI-2 (alternative):** Authorize switching the workflow to `ubuntu-latest` (GitHub-hosted) pending runner provisioning. This is the registry's default for non-onboarded repos, but switching requires explicit approval.

Recommendation: provision the repo-scoped runner (B-CI-1) to preserve the policy and avoid hosted-runner cost; keep `ubuntu-latest` only as a temporary fallback if provisioning is delayed.

---

## 2. Architecture Validation (Task 2)

### 2.1 Proposed service-desk tables mapped to existing entities

| Proposed table | Maps to / references | Notes |
|---|---|---|
| `service_tickets` | `businesses.id` (tenant root), `customers.id` (restrict, composite businessId), `user.id` (createdBy/assignee) | New top-level entity; business-scoped. Optional links to `invoices.id` and `quotations.id` for traceability (added in revised proposal). |
| `service_ticket_comments` | `service_tickets.id` (cascade, composite businessId), `user.id` (author) | Threaded; `isInternal` flag for staff-only notes. |
| `service_ticket_events` | `service_tickets.id`, `user.id` (actor) | Immutable audit trail of status/priority/assignment changes. |
| `service_ticket_attachments` | `service_tickets.id`, `user.id` (uploadedBy) | Requires persistent object storage (blocked — see §6). |
| `service_level_policies` | `businesses.id` | Per-business SLA config; optional. |

### 2.2 Foreign-key gaps documented (quotations & sales orders)

Verified against `lib/db/schema.ts`:

| Table | FK | Status | Risk |
|---|---|---|---|
| `invoices` | `invoices_customer_business_fk` (businessId, customerId) → customers | ✅ composite | — |
| `payments` | `payments_customer_business_fk` (businessId, customerId) → customers | ✅ composite | — |
| `creditNotes` | `credit_notes_customer_fk`, `credit_notes_invoice_fk` (businessId, …) | ✅ composite | — |
| `quotations` | `quotations_customer_fk` → `customers.id` (single column) | ❌ **GAP** | Quotation can reference a customer from another business if app layer fails. |
| `salesOrders` | `sales_orders_customer_fk` → `customers.id` (single column); `sales_orders_warehouse_fk` → `warehouses.id` (single column) | ❌ **GAP** | Order can reference a foreign-business customer/warehouse. |
| `stockMovements` | `stock_movements_created_by_fk` → `user.id` (single column) | ❌ **GAP (low)** | Actor not bound to a membership at DB level; app layer enforces. |

Recommended corrections (additive, in a future migration after approval):
- Add `quotations_customer_business_fk` on (businessId, customerId) → customers(businessId, id), restrict; drop single-column FK.
- Add `sales_orders_customer_business_fk` on (businessId, customerId) → customers; add `sales_orders_warehouse_business_fk` on (businessId, warehouseId) → warehouses(businessId, id); drop single-column FKs.
- Optionally change `stockMovements.createdBy` to a composite (businessId, createdBy) → business_memberships, restrict. (Lower priority.)

### 2.3 Permission verification (7 proposed vs existing RBAC)

Existing `BusinessPermission` union in `lib/permissions.ts` has 26 permissions; none overlap with the proposed 7. The new permissions are additive and non-conflicting.

| Proposed permission | Suggested role grants | Rationale |
|---|---|---|
| `service_ticket.create` | owner, administrator, finance_manager, sales_officer | Create tickets |
| `service_ticket.read` | all roles incl. viewer, cashier | View tickets |
| `service_ticket.update` | owner, administrator, finance_manager, sales_officer | Edit ticket fields |
| `service_ticket.assign` | owner, administrator, finance_manager | Assign/reassign |
| `service_ticket.resolve` | owner, administrator, finance_manager, sales_officer | Mark resolved |
| `service_ticket.close` | owner, administrator | Close/cancel |
| `service_ticket.comment_internal` | owner, administrator, finance_manager, accountant, sales_officer | Internal notes |

Enforcement pattern to follow: `requireBusinessPermission(permission, businessId?)` (exact business validation), as used by all existing actions. Platform owner operates as `owner` equivalent within a selected business.

### 2.4 Tenancy & client portal isolation
- There is **no separate client-portal auth model**: customers are records owned by a business, not users. The service desk "client" is a `customers` row. This matches the existing multi-tenant model and avoids public client registration (which is prohibited).
- Cross-client isolation = businessId scoping + composite FKs + `requireBusinessPermission`. New tables must follow the same pattern.
- No public registration endpoint will be added; all access is via business membership.

### 2.5 Financial integration with existing modules
Service tickets integrate additively with:
- `customers` (owner of the ticket; composite FK).
- `quotations` / `invoices` / `payments` / `receipts` — optional reference fields on the ticket for traceability (e.g., a ticket raised against an invoice). These are read-only references; no changes to financial modules.
- Audit logging via existing `audit_logs` pattern (`insertAudit`).
- Document generation unchanged (no new PDF types in M2).

---

## 3. Revised Additive Schema Proposal (M2)

No migration created. Proposed (additive only, business-scoped, composite FKs):

```sql
-- service_tickets
CREATE TABLE service_tickets (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assignee_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  related_invoice_id text,
  related_quotation_id text,
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  FOREIGN KEY (business_id, customer_id) REFERENCES customers(business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, related_invoice_id) REFERENCES invoices(business_id, id) ON DELETE SET NULL,
  FOREIGN KEY (business_id, related_quotation_id) REFERENCES quotations(business_id, id) ON DELETE SET NULL
);
-- CHECK constraints for status/priority enums; indexes on business_id, status, customer_id, assignee.

-- service_ticket_comments (id, business_id, ticket_id, author_user_id, body, is_internal, created_at)
--   composite FK (business_id, ticket_id) -> service_tickets; FK author -> user

-- service_ticket_events (id, business_id, ticket_id, actor_user_id, event_type, from_value, to_value, created_at)
--   composite FK (business_id, ticket_id) -> service_tickets; FK actor -> user

-- service_ticket_attachments (id, business_id, ticket_id, uploaded_by, filename, mime_type, size_bytes, storage_url, created_at)
--   composite FK; requires object storage (blocked)

-- service_level_policies (id, business_id, name, response_minutes, resolution_minutes, is_default, created_at)
--   FK business_id -> businesses
```

Additive enum constants and `documentSequences` document type `'service_ticket'` optional.

---

## 4. Permission Matrix (M2)

Add to `BusinessPermission` union and `rolePermissions` in `lib/permissions.ts`. Enforcement via `requireBusinessPermission`. Platform owner = `owner` equivalent in selected business.

---

## 5. Security Test Plan (M2)

Following `tests/TESTING_STRATEGY.md` patterns (static + real DB when `DATABASE_URL_TEST` available):

- Unit (real): `roleHasPermission` for new permissions; permission matrix assertions.
- Integration (real DB, ci-test branch): ticket CRUD scoped by business; comment/event creation; assignment; status transitions.
- Security (static + real): cross-business ticket access rejected (IDOR); unauthorized role cannot create/assign/close; internal comment hidden from non-staff; attachment upload permission-gated; cross-tenant FK rejection.
- E2E: create ticket → comment → assign → resolve → close; verify audit events.
- All new actions must call `requireBusinessPermission` and `insertAudit`.

---

## 6. M2 Task Breakdown

| ID | Task | Dependencies | Acceptance criteria |
|---|---|---|---|
| M2-1 | Provision repo-scoped runner (B-CI-1) OR approve hosted fallback (B-CI-2) | Owner approval | Runner online with labels; workflow completes |
| M2-2 | Wire `DATABASE_URL_TEST` → Neon ci-test branch in CI env | M2-1 | Real integration tests run in CI |
| M2-3 | Owner approval of revised schema (§3) | Isaac | Approval recorded |
| M2-4 | Create additive migrations (0013+) on staging; `drizzle-kit check` | M2-3 | Migrations validate on staging |
| M2-5 | Implement service ticket server actions + permission enforcement + audit | M2-4 | Actions covered by tests |
| M2-6 | Implement API routes (§6.3 of M1 audit) with `loadEnv()` | M2-5 | Routes return scoped data |
| M2-7 | Implement frontend screens (ticket list/detail/create/comment) | M2-6 | Working UI with empty states |
| M2-8 | Implement invitation flow (client org provisioning, membership, expiring single-use tokens, email activation, suspension/reactivation) | M2-4 | Full lifecycle tested |
| M2-9 | Persistent object storage for logos/attachments | Storage credentials (blocked) | Uploads survive redeploy |
| M2-10 | Cross-client isolation test suite (real DB) | M2-2, M2-5 | All isolation tests pass |
| M2-11 | Staging acceptance sign-off | All above | Report complete |
| M2-12 | Production migration + deployment | Explicit owner approval | Gated |

### 6.1 Client organization provisioning & membership (M2-8 detail)
- Reuse existing `businesses` + `business_memberships` (no new auth model; no public registration).
- Client org provisioning: `createBusiness` already exists; ensure owner membership auto-assigned (verify in code).
- Membership roles: reuse 7 roles; service desk adds ticket permissions to matrix.
- Invitations: new `business_invitations` table (token hashed, single-use, expiring, email-bound) — additive. `inviteMember` exists but uses email lookup; verify single-use/expiry.
- Activation: email link → verify token → create/attach membership. SMTP already integrated.
- Suspension/reactivation: `suspendMembership`/`removeMembership` exist (soft-delete). Verify reactivation path.
- Audit: all membership changes via `insertAudit`.

### 6.2 Dependencies
- M2-1/M2-2 (CI) gate all test-dependent tasks.
- M2-3/M2-4 (schema approval + staging migration) gate M2-5+.
- Object storage credentials gate M2-9 only.

---

## 7. Outstanding Blockers

| ID | Blocker | Owner action |
|---|---|---|
| B-CI-1 | No runner provisioned for JITHUB-TEQ-MGT | Authorize provisioning |
| B-CI-2 | (alt) Hosted-runner fallback approval | Approve if needed |
| B-DB-1 | No `DATABASE_URL_TEST` configured | Provide ci-test connection string |
| B-STOR-1 | No S3-compatible storage credentials | Provide credentials or defer attachments |
| B-SCHEMA-1 | Schema approval (§3) | Approve |
| B-PROD-1 | Production migration/deployment authorization | Defer until gates pass |
| B-DOC-1 | `drizzle/meta/_journal.json` empty despite 12 migrations | Regenerate before next migration |

Latent code finding (non-blocking, for awareness): `insertPlatformAudit` inserts `businessId: null` into `audit_logs` whose `businessId` is `NOT NULL` — potential runtime failure on platform audit path. Recommend verifying whether it is ever invoked (grep shows 1 reference: definition only) and either making the column nullable or removing the platform-audit insert.

---

## 8. Approval Gate

This report is submitted for Isaac's review and approval. **No M2 implementation has begun.** No production changes, migrations, or deployments were made.

Requested: approve M2-1 (runner provisioning decision), M2-3 (schema), and the overall M2 plan before implementation starts.

— End of report —

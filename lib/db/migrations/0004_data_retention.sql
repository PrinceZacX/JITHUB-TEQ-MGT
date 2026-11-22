-- Migration 0004: Data Retention - Soft Delete Memberships
--
-- Replaces ON DELETE CASCADE on business_memberships foreign keys with
-- ON DELETE RESTRICT to prevent historical financial records from being
-- deleted when a membership is removed.
--
-- Adds soft-delete columns (deleted_at, deleted_by) and a status column
-- (active/suspended/removed) to business_memberships so access can be
-- revoked without destroying data.
--
-- Strategy:
-- 1. Add deleted_at, deleted_by, status, updatedAt to business_memberships
-- 2. Change all FKs referencing business_memberships to ON DELETE RESTRICT
-- 3. Change memberships_business_fk and memberships_user_fk to ON DELETE RESTRICT
-- 4. Application code uses soft-delete instead of hard delete

-- ------------------------------------------------------------------
-- 1. Add soft-delete columns to business_memberships
-- ------------------------------------------------------------------

ALTER TABLE business_memberships
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE business_memberships
  ADD CONSTRAINT IF NOT EXISTS memberships_status_valid
  CHECK (status IN ('active','suspended','removed'));

-- ------------------------------------------------------------------
-- 2. Change FKs referencing business_memberships to ON DELETE RESTRICT
-- ------------------------------------------------------------------

-- Drop and recreate each constraint with RESTRICT
-- PostgreSQL does not support ALTER CONSTRAINT directly, so we drop
-- and re-add with the new ON DELETE action.

-- customers
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_business_user_fk;
ALTER TABLE customers
  ADD CONSTRAINT customers_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE RESTRICT;

-- catalogue_items
ALTER TABLE catalogue_items
  DROP CONSTRAINT IF EXISTS catalogue_items_business_user_fk;
ALTER TABLE catalogue_items
  ADD CONSTRAINT catalogue_items_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE RESTRICT;

-- invoices
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_business_user_fk;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE RESTRICT;

-- payments
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_business_user_fk;
ALTER TABLE payments
  ADD CONSTRAINT payments_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE RESTRICT;

-- receipts
ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS receipts_business_user_fk;
ALTER TABLE receipts
  ADD CONSTRAINT receipts_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE RESTRICT;

-- refunds
ALTER TABLE refunds
  DROP CONSTRAINT IF EXISTS refunds_requested_by_fk;
ALTER TABLE refunds
  ADD CONSTRAINT refunds_requested_by_fk
  FOREIGN KEY (business_id, requested_by) REFERENCES business_memberships(business_id, user_id) ON DELETE RESTRICT;

-- expenses
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_business_user_fk;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE RESTRICT;

-- audit_logs
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_business_user_fk;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE RESTRICT;

-- ------------------------------------------------------------------
-- 3. Change business_memberships self-referential FKs to RESTRICT
-- ------------------------------------------------------------------

-- Prevent deleting a business from cascading to memberships
ALTER TABLE business_memberships
  DROP CONSTRAINT IF EXISTS memberships_business_fk;
ALTER TABLE business_memberships
  ADD CONSTRAINT memberships_business_fk
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT;

-- Prevent deleting a user from cascading to memberships
ALTER TABLE business_memberships
  DROP CONSTRAINT IF EXISTS memberships_user_fk;
ALTER TABLE business_memberships
  ADD CONSTRAINT memberships_user_fk
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------------
-- 4. Indexes
-- ------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS memberships_deleted_at_idx ON business_memberships(deleted_at);
CREATE INDEX IF NOT EXISTS memberships_status_idx ON business_memberships(status);

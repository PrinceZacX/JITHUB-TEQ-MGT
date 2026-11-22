-- Migration 0006: Platform Owner Authorization
--
-- Adds platform-level ownership to the user model, enabling a platform
-- owner to administer the system independently of business membership.
--
-- Strategy:
-- 1. Add platform_owner boolean column to the user table (default false)
-- 2. Add index for platform owner lookups
-- 3. Make auditLogs.business_id nullable for platform audit records
-- 4. Provision Isaac Asire (isaacasiire@gmail.com) as the initial platform owner
-- 5. All changes are additive; existing users, businesses, memberships,
--    financial records, and authentication sessions are unchanged.
--
-- Rollback:
--   ALTER TABLE "user" DROP COLUMN IF EXISTS platform_owner;
--   DROP INDEX IF EXISTS user_platform_owner_idx;
--   ALTER TABLE audit_logs ALTER COLUMN business_id SET NOT NULL;
--   (Provisioned owner flag remains unless explicitly cleared.)

-- ------------------------------------------------------------------
-- 1. Add platform_owner column to user table
-- ------------------------------------------------------------------

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS platform_owner BOOLEAN NOT NULL DEFAULT FALSE;

-- ------------------------------------------------------------------
-- 2. Add index for platform owner lookups
-- ------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS user_platform_owner_idx
  ON "user"(platform_owner);

-- ------------------------------------------------------------------
-- 3. Make auditLogs.business_id nullable for platform audit records
-- ------------------------------------------------------------------

ALTER TABLE audit_logs
  ALTER COLUMN business_id DROP NOT NULL;

-- ------------------------------------------------------------------
-- 4. Provision the initial platform owner
-- ------------------------------------------------------------------
-- Isaac Asire (isaacasiire@gmail.com) is provisioned as platform owner
-- using a targeted UPDATE keyed on the verified email address.
-- The account must already exist in Better Auth; this migration only
-- sets the platform_owner flag. It does not create a duplicate account.

UPDATE "user"
SET platform_owner = TRUE,
    updated_at = NOW()
WHERE email = 'isaacasiire@gmail.com'
  AND emailVerified = TRUE;

-- ------------------------------------------------------------------
-- 5. Idempotency note
-- ------------------------------------------------------------------
-- This migration is idempotent: ADD COLUMN IF NOT EXISTS and CREATE
-- INDEX IF NOT EXISTS are safe to re-run. The UPDATE is also safe to
-- re-run (no-op if already set). The emailVerified = TRUE guard ensures
-- the owner is only provisioned after email verification.

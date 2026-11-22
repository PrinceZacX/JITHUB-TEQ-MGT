-- Migration 0005: Fix invalid partial unique constraint
--
-- Migration 0001 used invalid PostgreSQL syntax for a partial unique index:
--   CONSTRAINT ... UNIQUE (cols) WHERE col IS NULL
-- PostgreSQL does not support WHERE clauses on table-level UNIQUE constraints.
-- Partial indexes must use CREATE UNIQUE INDEX ... WHERE ...
--
-- This migration drops the invalid constraint (if it exists) and creates
-- the proper partial unique index.

-- ------------------------------------------------------------------
-- 1. Drop invalid table-level partial unique constraint on refunds
-- ------------------------------------------------------------------

ALTER TABLE refunds
  DROP CONSTRAINT IF EXISTS refunds_idempotency_key_business_uq;

-- ------------------------------------------------------------------
-- 2. Create proper partial unique index on refunds
-- ------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS refunds_idempotency_key_business_uq
  ON refunds (business_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

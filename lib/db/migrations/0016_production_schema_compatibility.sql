-- Migration 0016: Production schema compatibility
--
-- Reconciles additive schema drift found in the deployed database with the
-- current Drizzle application contract. Existing legacy columns are retained
-- so older deployments remain compatible during the rollout.
--
-- No business, invoice, payment, refund, ticket, or invitation rows are deleted.

-- Business document prefixes required by the application.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS quotation_prefix TEXT NOT NULL DEFAULT 'QTN';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS sales_order_prefix TEXT NOT NULL DEFAULT 'SO';

-- Invitation acceptance column expected by the current application.
-- Keep the legacy accepted_by column until all older deployments are retired.
ALTER TABLE business_invitations
  ADD COLUMN IF NOT EXISTS accepted_by_user_id TEXT;

DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_invitations'
      AND column_name = 'accepted_by'
  ) THEN
    UPDATE business_invitations
    SET accepted_by_user_id = accepted_by
    WHERE accepted_by_user_id IS NULL
      AND accepted_by IS NOT NULL;
  END IF;
END
$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_invitations_accepted_by_fk'
      AND conrelid = 'business_invitations'::regclass
  ) THEN
    ALTER TABLE business_invitations
      ADD CONSTRAINT business_invitations_accepted_by_user_id_fk
      FOREIGN KEY (accepted_by_user_id) REFERENCES "user"(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- SLA fields expected by the current application. Legacy hour-based columns
-- and the priority column remain available for backward compatibility.
ALTER TABLE service_level_policies
  ADD COLUMN IF NOT EXISTS response_minutes INTEGER NOT NULL DEFAULT 60;

ALTER TABLE service_level_policies
  ADD COLUMN IF NOT EXISTS resolution_minutes INTEGER NOT NULL DEFAULT 480;

ALTER TABLE service_level_policies
  ADD COLUMN IF NOT EXISTS applies_to_priorities TEXT[] NOT NULL
    DEFAULT ARRAY['low','normal','high','critical','urgent']::TEXT[];

ALTER TABLE service_level_policies
  ADD COLUMN IF NOT EXISTS business_hours_only BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE service_level_policies
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Kampala';

-- Preserve existing SLA intent while converting hours to minutes.
DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_level_policies'
      AND column_name = 'response_time_hours'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_level_policies'
      AND column_name = 'resolution_time_hours'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_level_policies'
      AND column_name = 'priority'
  ) THEN
    UPDATE service_level_policies
    SET
      response_minutes = GREATEST(response_time_hours, 1) * 60,
      resolution_minutes = GREATEST(resolution_time_hours, 1) * 60,
      applies_to_priorities = ARRAY[priority]::TEXT[];
  END IF;
END
$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_level_policies_response_positive'
      AND conrelid = 'service_level_policies'::regclass
  ) THEN
    ALTER TABLE service_level_policies
      ADD CONSTRAINT service_level_policies_response_minutes_positive
      CHECK (response_minutes > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_level_policies_resolution_positive'
      AND conrelid = 'service_level_policies'::regclass
  ) THEN
    ALTER TABLE service_level_policies
      ADD CONSTRAINT service_level_policies_resolution_minutes_positive
      CHECK (resolution_minutes > 0);
  END IF;
END
$$;

-- Migration 0014: Valuation Groups System Protection
--
-- Replaces the invalid CHECK constraint (valuation_groups_system_protect)
-- which used a subquery (not allowed in PostgreSQL CHECK constraints).
-- Implements the same protection via a BEFORE UPDATE/DELETE trigger.
--
-- Business rule: System valuation groups (is_system = true) cannot be:
--   1. Deleted
--   2. Have is_system set to false
--   3. Have is_default set to false (if it was true)
--
-- Normal updates (name, description, etc.) are allowed.

-- Drop the invalid constraint if it exists
ALTER TABLE valuation_groups DROP CONSTRAINT IF EXISTS valuation_groups_system_protect;

-- Create the protection trigger function
CREATE OR REPLACE FUNCTION protect_system_valuation_groups()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system = true THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete a system valuation group';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.is_system = false THEN
      RAISE EXCEPTION 'Cannot unset is_system on a system valuation group';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_default = true AND NEW.is_default = false THEN
      RAISE EXCEPTION 'Cannot unset is_default on a system valuation group';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_protect_system_valuation_groups ON valuation_groups;
CREATE TRIGGER trigger_protect_system_valuation_groups
  BEFORE UPDATE OR DELETE ON valuation_groups
  FOR EACH ROW EXECUTE FUNCTION protect_system_valuation_groups();
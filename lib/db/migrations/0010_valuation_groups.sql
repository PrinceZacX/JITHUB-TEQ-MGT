-- Migration 0010: Valuation Groups and Item Costing Extensions
-- Implements costing policy management per operational policy Section B

-- ============================================================================
-- Valuation Groups already created in 0009_costing_layers.sql
-- This migration adds additional fields and constraints
-- ============================================================================

-- Ensure valuation_groups table has all required columns
DO $$
BEGIN
  -- Add is_system column to prevent deletion of system groups
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'valuation_groups' AND column_name = 'is_system'
  ) THEN
    ALTER TABLE valuation_groups ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Mark default groups as system groups
UPDATE valuation_groups SET is_system = true WHERE is_default = true;

-- Add constraint to prevent deletion of system valuation groups
ALTER TABLE valuation_groups 
  ADD CONSTRAINT valuation_groups_system_protect 
  CHECK (NOT is_system OR NOT EXISTS (
    SELECT 1 FROM valuation_groups WHERE is_system = true AND id = valuation_groups.id
  ));
-- Note: The above is a conceptual constraint; actual enforcement via trigger or application logic

-- ============================================================================
-- Add costing method to items (override per item)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'costing_method'
  ) THEN
    ALTER TABLE items ADD COLUMN costing_method TEXT;
    ALTER TABLE items ADD CONSTRAINT items_costing_method_valid 
      CHECK (costing_method IS NULL OR costing_method IN ('fifo', 'weighted_average'));
  END IF;
END $$;

-- Add weighted average cost fields to items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'average_cost'
  ) THEN
    ALTER TABLE items ADD COLUMN average_cost NUMERIC(18,4) DEFAULT '0';
    ALTER TABLE items ADD COLUMN average_cost_currency TEXT DEFAULT 'UGX';
  END IF;
END $$;

-- Add costing method to warehouses (for warehouse-specific overrides if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'costing_method'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN costing_method TEXT;
    ALTER TABLE warehouses ADD CONSTRAINT warehouses_costing_method_valid
      CHECK (costing_method IS NULL OR costing_method IN ('fifo', 'weighted_average'));
  END IF;
END $$;

-- ============================================================================
-- Stock Levels - Ensure reserved quantity tracking
-- ============================================================================

-- The stock_levels table should already have quantity_reserved from 0003_wholesale_distribution.sql
-- Ensure quantity_available is properly maintained
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_levels' AND column_name = 'quantity_unavailable'
  ) THEN
    ALTER TABLE stock_levels ADD COLUMN quantity_unavailable NUMERIC(18,3) NOT NULL DEFAULT '0';
    -- Unavailable includes damaged, expired, quarantined
  END IF;
END $$;

-- Add comment to clarify quantity_available calculation
COMMENT ON COLUMN stock_levels.quantity_available IS 
'Computed: quantity_on_hand - quantity_reserved - quantity_unavailable. Updated by application logic.';

-- ============================================================================
-- Quotation status check constraint (ensure 'converted' is included)
-- ============================================================================
-- The quotations table should already have this from 0007 migration
-- Just verify the constraint includes 'converted'

DO $$
BEGIN
  -- Drop and recreate constraint to ensure 'converted' is included
  ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_valid;
  ALTER TABLE quotations ADD CONSTRAINT quotations_status_valid 
    CHECK (status IN ('draft','sent','accepted','expired','converted','cancelled'));
END $$;

-- ============================================================================
-- Sales Orders - ensure quotation_id foreign key exists
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_orders' AND column_name = 'quotation_id'
  ) THEN
    ALTER TABLE sales_orders ADD COLUMN quotation_id TEXT REFERENCES quotations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS sales_orders_quotation_idx ON sales_orders(quotation_id);
  END IF;
END $$;

-- ============================================================================
-- Sales Order Items - add quantity_reserved field
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_order_items' AND column_name = 'quantity_reserved'
  ) THEN
    ALTER TABLE sales_order_items ADD COLUMN quantity_reserved NUMERIC(18,3) NOT NULL DEFAULT '0';
  END IF;
END $$;

-- ============================================================================
-- Add valuation_group_id to items (already added in 0009, but ensure index)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'items' AND indexname = 'items_valuation_group_idx'
  ) THEN
    CREATE INDEX items_valuation_group_idx ON items(valuation_group_id);
  END IF;
END $$;

-- ============================================================================
-- Add costing method to warehouses (optional override)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'costing_method'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN costing_method TEXT;
    ALTER TABLE warehouses ADD CONSTRAINT warehouses_costing_method_valid
      CHECK (costing_method IS NULL OR costing_method IN ('fifo', 'weighted_average'));
  END IF;
END $$;

-- ============================================================================
-- Add stock reservation fields to sales_order_items
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_order_items' AND column_name = 'quantity_reserved'
  ) THEN
    ALTER TABLE sales_order_items ADD COLUMN quantity_reserved NUMERIC(18,3) NOT NULL DEFAULT '0';
  END IF;
END $$;

-- ============================================================================
-- Ensure stock_levels has all required columns
-- ============================================================================
DO $$
BEGIN
  -- quantity_unavailable for damaged/expired/quarantined
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_levels' AND column_name = 'quantity_unavailable'
  ) THEN
    ALTER TABLE stock_levels ADD COLUMN quantity_unavailable NUMERIC(18,3) NOT NULL DEFAULT '0';
  END IF;
  
  -- Ensure quantity_reserved exists (from 0003)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_levels' AND column_name = 'quantity_reserved'
  ) THEN
    ALTER TABLE stock_levels ADD COLUMN quantity_reserved NUMERIC(18,3) NOT NULL DEFAULT '0';
  END IF;
END $$;

-- Add comment to clarify quantity_available calculation
COMMENT ON COLUMN stock_levels.quantity_available IS 
'Computed: quantity_on_hand - quantity_reserved - quantity_unavailable. Updated by application logic after each stock movement.';

-- ============================================================================
-- Add indexes for performance on new columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS items_costing_method_idx ON items(costing_method);
CREATE INDEX IF NOT EXISTS warehouses_costing_method_idx ON warehouses(costing_method);
CREATE INDEX IF NOT EXISTS items_valuation_group_idx ON items(valuation_group_id);

-- ============================================================================
-- Trigger to update updated_at on valuation_groups
-- ============================================================================
CREATE OR REPLACE FUNCTION update_valuation_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_valuation_groups_updated_at ON valuation_groups;
CREATE TRIGGER trigger_valuation_groups_updated_at
  BEFORE UPDATE ON valuation_groups
  FOR EACH ROW EXECUTE FUNCTION update_valuation_groups_updated_at();

-- ============================================================================
-- Trigger to update items average_cost on goods receipt
-- This will be handled by application logic, but we can add a trigger for safety
-- ============================================================================

-- Note: Average cost calculation is handled in application code for flexibility
-- (weighted average requires knowing the exact quantities and costs at receipt time)
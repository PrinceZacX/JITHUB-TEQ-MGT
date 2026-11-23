-- Migration 0011: Stock Levels Reserved Quantity
-- Ensures stock_levels table has proper reserved quantity tracking per operational policy

-- ============================================================================
-- Stock Levels - Reserved Quantity Tracking
-- ============================================================================

-- The stock_levels table was created in 0003_wholesale_distribution.sql with quantity_reserved
-- This migration ensures all required columns exist and are properly configured

-- ============================================================================
-- Ensure all required columns exist on stock_levels
-- ============================================================================

DO $$
BEGIN
  -- quantity_on_hand - physical stock on hand
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_levels' AND column_name = 'quantity_on_hand'
  ) THEN
    ALTER TABLE stock_levels ADD COLUMN quantity_on_hand NUMERIC(18,3) NOT NULL DEFAULT '0';
  END IF;

  -- quantity_reserved - stock reserved for sales orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_levels' AND column_name = 'quantity_reserved'
  ) THEN
    ALTER TABLE stock_levels ADD COLUMN quantity_reserved NUMERIC(18,3) NOT NULL DEFAULT '0';
  END IF;

  -- quantity_unavailable - damaged, expired, quarantined stock
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_levels' AND column_name = 'quantity_unavailable'
  ) THEN
    ALTER TABLE stock_levels ADD COLUMN quantity_unavailable NUMERIC(18,3) NOT NULL DEFAULT '0';
  END IF;

  -- quantity_available - computed: on_hand - reserved - unavailable
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_levels' AND column_name = 'quantity_available'
  ) THEN
    ALTER TABLE stock_levels ADD COLUMN quantity_available NUMERIC(18,3) NOT NULL DEFAULT '0';
  END IF;
END $$;

-- ============================================================================
-- Add check constraints for non-negative quantities
-- ============================================================================

DO $$
BEGIN
  -- Drop existing constraints if they exist with wrong definition
  ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_quantity_on_hand_nonnegative;
  ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_quantity_reserved_nonnegative;
  ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_quantity_unavailable_nonnegative;
  ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_quantity_available_nonnegative;
END $$;

ALTER TABLE stock_levels
  ADD CONSTRAINT stock_levels_quantity_on_hand_nonnegative CHECK (quantity_on_hand >= 0),
  ADD CONSTRAINT stock_levels_quantity_reserved_nonnegative CHECK (quantity_reserved >= 0),
  ADD CONSTRAINT stock_levels_quantity_unavailable_nonnegative CHECK (quantity_unavailable >= 0),
  ADD CONSTRAINT stock_levels_quantity_available_nonnegative CHECK (quantity_available >= 0);

-- ============================================================================
-- Add check constraint: reserved cannot exceed on_hand
-- ============================================================================
ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_reserved_not_exceed_on_hand;
ALTER TABLE stock_levels
  ADD CONSTRAINT stock_levels_reserved_not_exceed_on_hand 
  CHECK (quantity_reserved <= quantity_on_hand);

-- ============================================================================
-- Add constraint: available = on_hand - reserved - unavailable (enforced by application)
-- ============================================================================
-- We don't enforce this as a constraint since it's computed, but we can add a trigger
-- to keep it in sync automatically

-- ============================================================================
-- Trigger to auto-update quantity_available
-- ============================================================================

CREATE OR REPLACE FUNCTION update_stock_level_available()
RETURNS TRIGGER AS $$
BEGIN
  NEW.quantity_available := GREATEST(0, NEW.quantity_on_hand - NEW.quantity_reserved - NEW.quantity_unavailable);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stock_level_available ON stock_levels;
CREATE TRIGGER trigger_stock_level_available
  BEFORE INSERT OR UPDATE ON stock_levels
  FOR EACH ROW EXECUTE FUNCTION update_stock_level_available();

-- ============================================================================
-- Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN stock_levels.quantity_on_hand IS 'Physical stock currently in the warehouse';
COMMENT ON COLUMN stock_levels.quantity_reserved IS 'Stock reserved for confirmed sales orders (not yet dispatched)';
COMMENT ON COLUMN stock_levels.quantity_unavailable IS 'Stock that is damaged, expired, quarantined, or otherwise unsellable';
COMMENT ON COLUMN stock_levels.quantity_available IS 'Computed: on_hand - reserved - unavailable. Available for new reservations.';

-- ============================================================================
-- Add indexes for common queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS stock_levels_available_idx ON stock_levels(quantity_available) WHERE quantity_available > 0;
CREATE INDEX IF NOT EXISTS stock_levels_reserved_idx ON stock_levels(quantity_reserved) WHERE quantity_reserved > 0;

-- ============================================================================
-- Function to recalculate available for all stock levels (for migration/fix)
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_all_stock_available()
RETURNS VOID AS $$
BEGIN
  UPDATE stock_levels
  SET quantity_available = GREATEST(0, quantity_on_hand - quantity_reserved - quantity_unavailable);
END;
$$ LANGUAGE plpgsql;

-- Run recalculation on migration
SELECT recalculate_all_stock_available();

-- ============================================================================
-- Function to check available stock for reservation
-- ============================================================================

CREATE OR REPLACE FUNCTION check_stock_available(
  p_business_id TEXT,
  p_item_id TEXT,
  p_warehouse_id TEXT,
  p_quantity NUMERIC
)
RETURNS TABLE (
  available BOOLEAN,
  available_qty NUMERIC,
  on_hand NUMERIC,
  reserved NUMERIC,
  unavailable NUMERIC,
  available_qty NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (sl.quantity_on_hand - sl.quantity_reserved - sl.quantity_unavailable) >= p_quantity AS available,
    GREATEST(0, sl.quantity_on_hand - sl.quantity_reserved - sl.quantity_unavailable) AS available_qty,
    sl.quantity_on_hand,
    sl.quantity_reserved,
    sl.quantity_unavailable,
    GREATEST(0, sl.quantity_on_hand - sl.quantity_reserved - sl.quantity_unavailable) AS available_qty
  FROM stock_levels sl
  WHERE sl.business_id = p_business_id
    AND sl.item_id = p_item_id
    AND sl.warehouse_id = p_warehouse_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to reserve stock atomically
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_stock(
  p_business_id TEXT,
  p_sales_order_id TEXT,
  p_sales_order_item_id TEXT,
  p_item_id TEXT,
  p_warehouse_id TEXT,
  p_quantity NUMERIC,
  p_created_by TEXT
)
RETURNS TABLE (reservation_id TEXT) AS $$
DECLARE
  v_available_qty NUMERIC;
  v_reservation_id TEXT := gen_random_uuid();
BEGIN
  -- Check availability with row-level lock
  SELECT sl.quantity_available INTO v_available_qty
  FROM stock_levels sl
  WHERE sl.business_id = p_business_id
    AND sl.item_id = p_item_id
    AND sl.warehouse_id = p_warehouse_id
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_available_qty, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock available. Available: %, Requested: %', 
      COALESCE(v_available_qty, 0), p_quantity;
  END IF;

  -- Update stock_levels: increase reserved
  UPDATE stock_levels
  SET quantity_reserved = quantity_reserved + p_quantity,
      quantity_available = GREATEST(0, quantity_on_hand - quantity_reserved - p_quantity - quantity_unavailable)
  WHERE business_id = p_business_id
    AND item_id = p_item_id
    AND warehouse_id = p_warehouse_id;

  -- Create reservation record
  INSERT INTO stock_reservations (
    id, business_id, sales_order_id, sales_order_item_id,
    item_id, warehouse_id, quantity_reserved, status, created_by
  ) VALUES (
    v_reservation_id, p_business_id, p_sales_order_id, p_sales_order_item_id,
    p_item_id, p_warehouse_id, p_quantity, 'active', p_created_by
  );

  RETURN QUERY SELECT v_reservation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to release stock reservation
-- ============================================================================

CREATE OR REPLACE FUNCTION release_stock_reservation(
  p_reservation_id TEXT,
  p_released_by TEXT
)
RETURNS VOID AS $$
DECLARE
  v_reservation stock_reservations%ROWTYPE;
  v_quantity_reserved NUMERIC;
  v_quantity_fulfilled NUMERIC;
  v_quantity_to_release NUMERIC;
BEGIN
  -- Get reservation with lock
  SELECT * INTO v_reservation
  FROM stock_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  IF v_reservation.status IN ('released', 'cancelled', 'fulfilled') THEN
    RAISE EXCEPTION 'Reservation already %', v_reservation.status;
  END IF;

  v_quantity_reserved := v_reservation.quantity_reserved;
  v_quantity_fulfilled := COALESCE(v_reservation.quantity_fulfilled, 0);
  v_quantity_to_release := v_quantity_reserved - v_quantity_fulfilled;

  IF v_quantity_to_release <= 0 THEN
    RAISE EXCEPTION 'No quantity remaining to release';
  END IF;

  -- Update stock_levels: decrease reserved
  UPDATE stock_levels
  SET quantity_reserved = quantity_reserved - v_quantity_to_release,
      quantity_available = GREATEST(0, quantity_on_hand - quantity_reserved + v_quantity_to_release - quantity_unavailable)
  WHERE business_id = v_reservation.business_id
    AND item_id = v_reservation.item_id
    AND warehouse_id = v_reservation.warehouse_id;

  -- Update reservation status
  UPDATE stock_reservations
  SET status = 'released',
      released_at = NOW(),
      released_by = p_released_by
  WHERE id = p_reservation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to fulfill stock reservation (on dispatch)
-- ============================================================================

CREATE OR REPLACE FUNCTION fulfill_stock_reservation(
  p_reservation_id TEXT,
  p_quantity NUMERIC,
  p_fulfilled_by TEXT
)
RETURNS TABLE (remaining_qty NUMERIC) AS $$
DECLARE
  v_reservation stock_reservations%ROWTYPE;
  v_new_fulfilled NUMERIC;
  v_remaining NUMERIC;
BEGIN
  -- Get reservation with lock
  SELECT * INTO v_reservation
  FROM stock_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  IF v_reservation.status NOT IN ('active', 'partially_fulfilled') THEN
    RAISE EXCEPTION 'Reservation cannot be fulfilled (status: %)', v_reservation.status;
  END IF;

  v_new_fulfilled := COALESCE(v_reservation.quantity_fulfilled, 0) + p_quantity;
  
  IF v_new_fulfilled > v_reservation.quantity_reserved THEN
    RAISE EXCEPTION 'Cannot fulfill more than reserved. Reserved: %, Already fulfilled: %, Requested: %',
      v_reservation.quantity_reserved, COALESCE(v_reservation.quantity_fulfilled, 0), p_quantity;
  END IF;

  v_remaining := v_reservation.quantity_reserved - v_new_fulfilled;

  -- Update reservation
  UPDATE stock_reservations
  SET quantity_fulfilled = v_new_fulfilled,
      status = CASE 
        WHEN v_new_fulfilled >= v_reservation.quantity_reserved THEN 'fulfilled'
        ELSE 'partially_fulfilled'
      END
  WHERE id = p_reservation_id;

  -- Update sales_order_items fulfilled quantity
  UPDATE sales_order_items
  SET quantity_fulfilled = quantity_fulfilled + p_quantity
  WHERE id = v_reservation.sales_order_item_id;

  RETURN QUERY SELECT v_remaining;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to get available stock for item/warehouse
-- ============================================================================

CREATE OR REPLACE FUNCTION get_available_stock(
  p_business_id TEXT,
  p_item_id TEXT,
  p_warehouse_id TEXT
)
RETURNS TABLE (
  quantity_on_hand NUMERIC,
  quantity_reserved NUMERIC,
  quantity_unavailable NUMERIC,
  quantity_available NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.quantity_on_hand,
    sl.quantity_reserved,
    sl.quantity_unavailable,
    sl.quantity_available
  FROM stock_levels sl
  WHERE sl.business_id = p_business_id
    AND sl.item_id = p_item_id
    AND sl.warehouse_id = p_warehouse_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Grant execute permissions (if using role-based access)
-- ============================================================================
-- GRANT EXECUTE ON FUNCTION check_stock_available TO authenticated;
-- GRANT EXECUTE ON FUNCTION reserve_stock TO authenticated;
-- GRANT EXECUTE ON FUNCTION release_stock_reservation TO authenticated;
-- GRANT EXECUTE ON FUNCTION fulfill_stock_reservation TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_available_stock TO authenticated;
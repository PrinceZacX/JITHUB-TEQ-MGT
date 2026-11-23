-- Migration 0008: Stock Reservations
-- Implements stock reservation lifecycle per operational policy Section D

-- ============================================================================
-- Stock Reservations
-- ============================================================================

-- Stock reservation statuses: active, partially_fulfilled, fulfilled, released, cancelled
CREATE TABLE IF NOT EXISTS stock_reservations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sales_order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  sales_order_item_id TEXT NOT NULL REFERENCES sales_order_items(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  quantity_reserved NUMERIC(18,3) NOT NULL,
  quantity_fulfilled NUMERIC(18,3) NOT NULL DEFAULT '0',
  status TEXT NOT NULL DEFAULT 'active', -- active, partially_fulfilled, fulfilled, released, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  released_by TEXT REFERENCES "user"(id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  FOREIGN KEY (released_by) REFERENCES "user"(id) ON DELETE SET NULL,
  CONSTRAINT stock_reservations_status_valid CHECK (status IN ('active','partially_fulfilled','fulfilled','released','cancelled'))
);

CREATE INDEX IF NOT EXISTS stock_reservations_business_idx ON stock_reservations(business_id);
CREATE INDEX IF NOT EXISTS stock_reservations_sales_order_idx ON stock_reservations(sales_order_id);
CREATE INDEX IF NOT EXISTS stock_reservations_sales_order_item_idx ON stock_reservations(sales_order_item_id);
CREATE INDEX IF NOT EXISTS stock_reservations_item_idx ON stock_reservations(item_id);
CREATE INDEX IF NOT EXISTS stock_reservations_warehouse_idx ON stock_reservations(warehouse_id);
CREATE INDEX IF NOT EXISTS stock_reservations_status_idx ON stock_reservations(status);

-- ============================================================================
-- Add reserved quantity to stock_levels (if not already present)
-- ============================================================================

-- The stock_levels table already has quantity_reserved from 0003_wholesale_distribution.sql
-- Just ensure it exists and has proper default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_levels' AND column_name = 'quantity_reserved'
  ) THEN
    ALTER TABLE stock_levels ADD COLUMN quantity_reserved NUMERIC(18,3) NOT NULL DEFAULT '0';
  END IF;
END $$;

-- Add quantity_available as computed/generated column or ensure it's updated
-- quantity_available = quantity_on_hand - quantity_reserved - unavailable
-- We'll keep it as a regular column updated by application logic

-- ============================================================================
-- Add quotation reference to sales_orders (if not present)
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
-- Add reservation tracking to sales_order_items
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
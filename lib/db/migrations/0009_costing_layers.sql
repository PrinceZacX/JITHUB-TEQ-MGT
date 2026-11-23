-- Migration 0009: Costing Layers (FIFO & Weighted Average)
-- Implements inventory costing per operational policy Section B

-- ============================================================================
-- Valuation Groups (Costing Policy)
-- ============================================================================

CREATE TABLE IF NOT EXISTS valuation_groups (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  costing_method TEXT NOT NULL, -- 'fifo', 'weighted_average'
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS valuation_groups_business_idx ON valuation_groups(business_id);

-- Default valuation group per business (created on business creation via trigger or application logic)
-- We'll add a default 'Standard' group with FIFO for each existing business
INSERT INTO valuation_groups (id, business_id, name, costing_method, is_default, description)
SELECT 
  gen_random_uuid(),
  b.id,
  'Standard',
  'fifo',
  true,
  'Default FIFO valuation group'
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM valuation_groups vg WHERE vg.business_id = b.id
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Costing Layers (FIFO)
-- ============================================================================

-- Costing layers for FIFO costing
-- Each layer represents a batch of inventory received at a specific cost
CREATE TABLE IF NOT EXISTS costing_layers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  quantity_received NUMERIC(18,3) NOT NULL,
  quantity_remaining NUMERIC(18,3) NOT NULL,
  unit_cost NUMERIC(18,4) NOT NULL, -- Higher precision for costing
  unit_cost_currency TEXT NOT NULL DEFAULT 'UGX',
  received_date DATE NOT NULL,
  source_type TEXT NOT NULL, -- 'purchase', 'adjustment', 'return', 'transfer_in', 'opening_balance'
  source_reference_id TEXT, -- purchase_order_id, goods_receipt_id, adjustment_id, transfer_id, etc.
  source_reference_type TEXT, -- 'purchase_order', 'goods_receipt', 'adjustment', 'transfer'
  valuation_group_id TEXT REFERENCES valuation_groups(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  FOREIGN KEY (valuation_group_id) REFERENCES valuation_groups(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS costing_layers_business_idx ON costing_layers(business_id);
CREATE INDEX IF NOT EXISTS costing_layers_item_warehouse_idx ON costing_layers(item_id, warehouse_id);
CREATE INDEX IF NOT EXISTS costing_layers_valuation_group_idx ON costing_layers(valuation_group_id);
CREATE INDEX IF NOT EXISTS costing_layers_received_date_idx ON costing_layers(received_date);
CREATE INDEX IF NOT EXISTS costing_layers_active_idx ON costing_layers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS costing_layers_remaining_idx ON costing_layers(quantity_remaining) WHERE quantity_remaining > 0;

-- ============================================================================
-- Add valuation_group_id to items table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'valuation_group_id'
  ) THEN
    ALTER TABLE items ADD COLUMN valuation_group_id TEXT REFERENCES valuation_groups(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS items_valuation_group_idx ON items(valuation_group_id);
  END IF;
END $$;

-- Add costing_method override to items (optional per-item override)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'costing_method'
  ) THEN
    ALTER TABLE items ADD COLUMN costing_method TEXT; -- 'fifo', 'weighted_average', or NULL for group default
    ALTER TABLE items ADD CONSTRAINT items_costing_method_valid 
      CHECK (costing_method IS NULL OR costing_method IN ('fifo', 'weighted_average'));
  END IF;
END $$;

-- Add costing fields to items for weighted average tracking
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
-- Migration 0007: Quotations, Sales Orders, and related tables
-- Implements the Quotations & Sales Orders module per operational policy

-- ============================================================================
-- Quotations
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, expired, converted, cancelled
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT '0',
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT '0',
  total NUMERIC(18,2) NOT NULL DEFAULT '0',
  currency TEXT NOT NULL DEFAULT 'UGX',
  notes TEXT,
  terms TEXT,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by TEXT REFERENCES "user"(id),
  converted_at TIMESTAMPTZ,
  converted_sales_order_id TEXT,
  CONSTRAINT quotations_status_valid CHECK (status IN ('draft','sent','accepted','expired','converted','cancelled')),
  CONSTRAINT quotations_number_business_uq UNIQUE (business_id, number),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE RESTRICT,
  FOREIGN KEY (accepted_by) REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS quotations_business_idx ON quotations(business_id);
CREATE INDEX IF NOT EXISTS quotations_customer_idx ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS quotations_status_idx ON quotations(status);
CREATE INDEX IF NOT EXISTS quotations_created_at_idx ON quotations(created_at);
CREATE INDEX IF NOT EXISTS quotations_valid_until_idx ON quotations(valid_until);

-- Quotation Items
CREATE TABLE IF NOT EXISTS quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  quantity NUMERIC(18,3) NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL,
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT '0',
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT '0',
  line_total NUMERIC(18,2) NOT NULL DEFAULT '0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quotation_items_quotation_idx ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS quotation_items_item_idx ON quotation_items(item_id);

-- ============================================================================
-- Sales Orders
-- ============================================================================

-- Sales order statuses: draft, confirmed, partially_fulfilled, fulfilled, cancelled
CREATE TABLE IF NOT EXISTS sales_orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  quotation_id TEXT REFERENCES quotations(id) ON DELETE SET NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, confirmed, partially_fulfilled, fulfilled, cancelled
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT '0',
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT '0',
  total NUMERIC(18,2) NOT NULL DEFAULT '0',
  currency TEXT NOT NULL DEFAULT 'UGX',
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  confirmed_by TEXT REFERENCES "user"(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_orders_status_valid CHECK (status IN ('draft','confirmed','partially_fulfilled','fulfilled','cancelled')),
  CONSTRAINT sales_orders_number_business_uq UNIQUE (business_id, number),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE RESTRICT,
  FOREIGN KEY (confirmed_by) REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sales_orders_business_idx ON sales_orders(business_id);
CREATE INDEX IF NOT EXISTS sales_orders_customer_idx ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS sales_orders_warehouse_idx ON sales_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS sales_orders_status_idx ON sales_orders(status);
CREATE INDEX IF NOT EXISTS sales_orders_quotation_idx ON sales_orders(quotation_id);
CREATE INDEX IF NOT EXISTS sales_orders_created_at_idx ON sales_orders(created_at);

-- Sales Order Items
CREATE TABLE IF NOT EXISTS sales_order_items (
  id TEXT PRIMARY KEY,
  sales_order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  quantity NUMERIC(18,3) NOT NULL,
  quantity_fulfilled NUMERIC(18,3) NOT NULL DEFAULT '0',
  unit_price NUMERIC(18,2) NOT NULL,
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT '0',
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT '0',
  line_total NUMERIC(18,2) NOT NULL DEFAULT '0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sales_order_items_order_idx ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS sales_order_items_item_idx ON sales_order_items(item_id);

-- ============================================================================
-- Quotation status enum update (add 'converted' if not present)
-- ============================================================================
-- Note: quotations table already has 'converted' in status check constraint
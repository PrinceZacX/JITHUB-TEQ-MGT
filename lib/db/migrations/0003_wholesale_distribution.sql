-- Migration 0003: Wholesale & Distribution Foundation
--
-- Adds tables for suppliers, warehouses, products (items), stock movements,
-- purchase orders, goods receipts, purchase returns, and tax configuration.
-- All tables are business-scoped with composite foreign keys for data isolation.

-- ------------------------------------------------------------------ */
/* Suppliers                                                          */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  registration_number TEXT,
  tax_identification_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Uganda',
  category TEXT,
  credit_limit NUMERIC(18,2) NOT NULL DEFAULT '0',
  credit_terms_days INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT suppliers_status_valid CHECK (status IN ('active','inactive','suspended')),
  CONSTRAINT suppliers_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS suppliers_business_idx ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS suppliers_status_idx ON suppliers(status);
CREATE INDEX IF NOT EXISTS suppliers_category_idx ON suppliers(category);

-- ------------------------------------------------------------------ */
/* Warehouses                                                         */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Uganda',
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT warehouses_status_valid CHECK (status IN ('active','inactive')),
  CONSTRAINT warehouses_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT warehouses_code_business_uq UNIQUE (business_id, code)
);

CREATE INDEX IF NOT EXISTS warehouses_business_idx ON warehouses(business_id);
CREATE INDEX IF NOT EXISTS warehouses_status_idx ON warehouses(status);

-- ------------------------------------------------------------------ */
/* Items (Product Catalogue with SKU, Barcode, UOM)                  */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'unit',
  unit_price NUMERIC(18,2) NOT NULL DEFAULT '0',
  cost_price NUMERIC(18,2) NOT NULL DEFAULT '0',
  tax_rate_id TEXT,
  reorder_level NUMERIC(18,3) NOT NULL DEFAULT '0',
  reorder_quantity NUMERIC(18,3) NOT NULL DEFAULT '0',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT items_status_valid CHECK (status IN ('active','inactive','discontinued')),
  CONSTRAINT items_unit_of_measure_valid CHECK (unit_of_measure IN ('unit','kg','g','lb','oz','ml','l','m','cm','mm','pair','dozen','box','case','pallet')),
  CONSTRAINT items_sku_business_uq UNIQUE (business_id, sku),
  CONSTRAINT items_barcode_business_uq UNIQUE (business_id, barcode),
  CONSTRAINT items_tax_rate_fk FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id) ON DELETE SET NULL,
  CONSTRAINT items_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS items_business_idx ON items(business_id);
CREATE INDEX IF NOT EXISTS items_sku_idx ON items(sku);
CREATE INDEX IF NOT EXISTS items_barcode_idx ON items(barcode);
CREATE INDEX IF NOT EXISTS items_category_idx ON items(category);
CREATE INDEX IF NOT EXISTS items_status_idx ON items(status);

-- ------------------------------------------------------------------ */
/* Tax Rates                                                          */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rate NUMERIC(7,4) NOT NULL, -- percentage as decimal (e.g., 18.0000 for 18%)
  type TEXT NOT NULL DEFAULT 'vat',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_rates_rate_positive CHECK (rate >= 0),
  CONSTRAINT tax_rates_type_valid CHECK (type IN ('vat','withholding','excise','other')),
  CONSTRAINT tax_rates_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tax_rates_business_idx ON tax_rates(business_id);
CREATE INDEX IF NOT EXISTS tax_rates_default_idx ON tax_rates(business_id, is_default);

-- ------------------------------------------------------------------ */
/* Stock Movements (Auditable Ledger)                                */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  quantity NUMERIC(18,3) NOT NULL,
  unit_cost NUMERIC(18,2),
  reference_type TEXT NOT NULL, -- 'purchase', 'sale', 'adjustment', 'transfer', 'return'
  reference_id TEXT,
  reference_number TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_movements_type_valid CHECK (movement_type IN ('in','out','adjustment')),
  CONSTRAINT stock_movements_item_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT stock_movements_warehouse_fk FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
  CONSTRAINT stock_movements_created_by_fk FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT stock_movements_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS stock_movements_business_idx ON stock_movements(business_id);
CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS stock_movements_warehouse_idx ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS stock_movements_reference_idx ON stock_movements(reference_type, reference_id);

-- ------------------------------------------------------------------ */
/* Stock Levels (Materialized view of current stock per item/warehouse) */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS stock_levels (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  quantity_on_hand NUMERIC(18,3) NOT NULL DEFAULT '0',
  quantity_reserved NUMERIC(18,3) NOT NULL DEFAULT '0',
  quantity_available NUMERIC(18,3) NOT NULL DEFAULT '0',
  last_movement_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_levels_item_warehouse_uq UNIQUE (business_id, item_id, warehouse_id),
  CONSTRAINT stock_levels_item_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT stock_levels_warehouse_fk FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
  CONSTRAINT stock_levels_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS stock_levels_business_idx ON stock_levels(business_id);
CREATE INDEX IF NOT EXISTS stock_levels_item_idx ON stock_levels(item_id);
CREATE INDEX IF NOT EXISTS stock_levels_warehouse_idx ON stock_levels(warehouse_id);

-- ------------------------------------------------------------------ */
/* Purchase Orders                                                    */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL,
  expected_date DATE,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT '0',
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT '0',
  total NUMERIC(18,2) NOT NULL DEFAULT '0',
  currency TEXT NOT NULL DEFAULT 'UGX',
  notes TEXT,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_orders_status_valid CHECK (status IN ('draft','submitted','approved','rejected','partially_received','completed','cancelled')),
  CONSTRAINT purchase_orders_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CONSTRAINT purchase_orders_warehouse_fk FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
  CONSTRAINT purchase_orders_created_by_fk FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT purchase_orders_approved_by_fk FOREIGN KEY (approved_by) REFERENCES "user"(id) ON DELETE SET NULL,
  CONSTRAINT purchase_orders_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT purchase_orders_number_business_uq UNIQUE (business_id, number)
);

CREATE INDEX IF NOT EXISTS purchase_orders_business_idx ON purchase_orders(business_id);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS purchase_orders_warehouse_idx ON purchase_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS purchase_orders_created_at_idx ON purchase_orders(created_at);

-- ------------------------------------------------------------------ */
/* Purchase Order Lines                                               */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  purchase_order_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity_ordered NUMERIC(18,3) NOT NULL,
  quantity_received NUMERIC(18,3) NOT NULL DEFAULT '0',
  unit_price NUMERIC(18,2) NOT NULL,
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT '0',
  line_total NUMERIC(18,2) NOT NULL DEFAULT '0',
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_order_lines_quantity_positive CHECK (quantity_ordered > 0),
  CONSTRAINT purchase_order_lines_unit_price_positive CHECK (unit_price >= 0),
  CONSTRAINT purchase_order_lines_line_total_positive CHECK (line_total >= 0),
  CONSTRAINT purchase_order_lines_po_fk FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT purchase_order_lines_item_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT purchase_order_lines_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS purchase_order_lines_po_idx ON purchase_order_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_order_lines_item_idx ON purchase_order_lines(item_id);
CREATE INDEX IF NOT EXISTS purchase_order_lines_business_idx ON purchase_order_lines(business_id);

-- ------------------------------------------------------------------ */
/* Goods Receipts                                                     */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS goods_receipts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  purchase_order_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  number TEXT NOT NULL,
  received_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(18,2) NOT NULL DEFAULT '0',
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT '0',
  total NUMERIC(18,2) NOT NULL DEFAULT '0',
  notes TEXT,
  received_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goods_receipts_status_valid CHECK (status IN ('draft','submitted','completed','cancelled')),
  CONSTRAINT goods_receipts_po_fk FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipts_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipts_warehouse_fk FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipts_received_by_fk FOREIGN KEY (received_by) REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipts_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipts_number_business_uq UNIQUE (business_id, number)
);

CREATE INDEX IF NOT EXISTS goods_receipts_business_idx ON goods_receipts(business_id);
CREATE INDEX IF NOT EXISTS goods_receipts_po_idx ON goods_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS goods_receipts_supplier_idx ON goods_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS goods_receipts_warehouse_idx ON goods_receipts(warehouse_id);
CREATE INDEX IF NOT EXISTS goods_receipts_status_idx ON goods_receipts(status);
CREATE INDEX IF NOT EXISTS goods_receipts_created_at_idx ON goods_receipts(created_at);

-- ------------------------------------------------------------------ */
/* Goods Receipt Lines                                                */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  goods_receipt_id TEXT NOT NULL,
  purchase_order_line_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity_received NUMERIC(18,3) NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL,
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT '0',
  line_total NUMERIC(18,2) NOT NULL DEFAULT '0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goods_receipt_lines_quantity_positive CHECK (quantity_received > 0),
  CONSTRAINT goods_receipt_lines_unit_price_positive CHECK (unit_price >= 0),
  CONSTRAINT goods_receipt_lines_line_total_positive CHECK (line_total >= 0),
  CONSTRAINT goods_receipt_lines_gr_fk FOREIGN KEY (goods_receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipt_lines_po_line_fk FOREIGN KEY (purchase_order_line_id) REFERENCES purchase_order_lines(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipt_lines_item_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipt_lines_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS goods_receipt_lines_gr_idx ON goods_receipt_lines(goods_receipt_id);
CREATE INDEX IF NOT EXISTS goods_receipt_lines_po_line_idx ON goods_receipt_lines(purchase_order_line_id);
CREATE INDEX IF NOT EXISTS goods_receipt_lines_item_idx ON goods_receipt_lines(item_id);
CREATE INDEX IF NOT EXISTS goods_receipt_lines_business_idx ON goods_receipt_lines(business_id);

-- ------------------------------------------------------------------ */
/* Purchase Returns                                                   */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS purchase_returns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  purchase_order_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  number TEXT NOT NULL,
  return_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(18,2) NOT NULL DEFAULT '0',
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT '0',
  total NUMERIC(18,2) NOT NULL DEFAULT '0',
  reason TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_returns_status_valid CHECK (status IN ('draft','submitted','completed','cancelled')),
  CONSTRAINT purchase_returns_po_fk FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT purchase_returns_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CONSTRAINT purchase_returns_warehouse_fk FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
  CONSTRAINT purchase_returns_created_by_fk FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT purchase_returns_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT purchase_returns_number_business_uq UNIQUE (business_id, number)
);

CREATE INDEX IF NOT EXISTS purchase_returns_business_idx ON purchase_returns(business_id);
CREATE INDEX IF NOT EXISTS purchase_returns_po_idx ON purchase_returns(purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_returns_supplier_idx ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS purchase_returns_status_idx ON purchase_returns(status);
CREATE INDEX IF NOT EXISTS purchase_returns_created_at_idx ON purchase_returns(created_at);

-- ------------------------------------------------------------------ */
/* Purchase Return Lines                                              */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS purchase_return_lines (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  purchase_return_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity_returned NUMERIC(18,3) NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL,
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT '0',
  line_total NUMERIC(18,2) NOT NULL DEFAULT '0',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_return_lines_quantity_positive CHECK (quantity_returned > 0),
  CONSTRAINT purchase_return_lines_unit_price_positive CHECK (unit_price >= 0),
  CONSTRAINT purchase_return_lines_line_total_positive CHECK (line_total >= 0),
  CONSTRAINT purchase_return_lines_return_fk FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
  CONSTRAINT purchase_return_lines_item_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT purchase_return_lines_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS purchase_return_lines_return_idx ON purchase_return_lines(purchase_return_id);
CREATE INDEX IF NOT EXISTS purchase_return_lines_item_idx ON purchase_return_lines(item_id);
CREATE INDEX IF NOT EXISTS purchase_return_lines_business_idx ON purchase_return_lines(business_id);

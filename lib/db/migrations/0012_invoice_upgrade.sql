-- Migration 0012: Invoice System Upgrade
--
-- Adds comprehensive invoice fields and credit notes support.
-- All changes are additive and backward-compatible.

-- ------------------------------------------------------------------
-- 1. Add new columns to invoices table
-- ------------------------------------------------------------------

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_reference TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_treatment TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,2) NOT NULL DEFAULT '0';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'percentage';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS other_charges NUMERIC(18,2) NOT NULL DEFAULT '0';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credited_amount NUMERIC(18,2) NOT NULL DEFAULT '0';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'UGX';

-- ------------------------------------------------------------------
-- 2. Add new columns to invoice_items table
-- ------------------------------------------------------------------

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tax_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(7,4) NOT NULL DEFAULT '0';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,2) NOT NULL DEFAULT '0';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------------
-- 3. Create credit_notes table
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  reason TEXT NOT NULL,
  issue_date DATE NOT NULL,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT '0',
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT '0',
  total NUMERIC(18,2) NOT NULL DEFAULT '0',
  credited_amount NUMERIC(18,2) NOT NULL DEFAULT '0',
  currency TEXT NOT NULL DEFAULT 'UGX',
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_notes_status_valid CHECK (status IN ('draft','issued','cancelled')),
  CONSTRAINT credit_notes_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  CONSTRAINT credit_notes_invoice_fk FOREIGN KEY (business_id, invoice_id) REFERENCES invoices(business_id, id) ON DELETE RESTRICT,
  CONSTRAINT credit_notes_customer_fk FOREIGN KEY (business_id, customer_id) REFERENCES customers(business_id, id) ON DELETE RESTRICT,
  CONSTRAINT credit_notes_created_by_fk FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE RESTRICT,
  CONSTRAINT credit_notes_number_business_uq UNIQUE (business_id, number)
);

CREATE INDEX IF NOT EXISTS credit_notes_business_idx ON credit_notes(business_id);
CREATE INDEX IF NOT EXISTS credit_notes_invoice_idx ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS credit_notes_customer_idx ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS credit_notes_status_idx ON credit_notes(status);

-- ------------------------------------------------------------------
-- 4. Create credit_note_items table
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS credit_note_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  credit_note_id TEXT NOT NULL,
  invoice_item_id TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL,
  tax_type TEXT NOT NULL DEFAULT 'standard',
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT '0',
  line_total NUMERIC(18,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_note_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT credit_note_items_unit_price_nonnegative CHECK (unit_price >= 0),
  CONSTRAINT credit_note_items_line_total_nonnegative CHECK (line_total >= 0),
  CONSTRAINT credit_note_items_cn_fk FOREIGN KEY (business_id, credit_note_id) REFERENCES credit_notes(business_id, id) ON DELETE RESTRICT,
  CONSTRAINT credit_note_items_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS credit_note_items_cn_idx ON credit_note_items(credit_note_id);
CREATE INDEX IF NOT EXISTS credit_note_items_business_idx ON credit_note_items(business_id);

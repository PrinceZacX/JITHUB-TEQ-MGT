-- Migration 0001: Multi-business workspace foundation
--
-- This migration transforms the single-user-scoped schema into a
-- multi-business workspace architecture while preserving all existing
-- records. It is safe to apply to staging first; production requires
-- explicit approval after reconciliation.
--
-- Strategy:
-- 1. Create new business/membership/sequence/refund tables.
-- 2. Add nullable business_id to existing owned tables.
-- 3. Add foreign keys, unique constraints, check constraints.
-- 4. Application code backfills business_id from user membership.

-- ------------------------------------------------------------------
-- 1. New tables
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  registration_number TEXT,
  tax_identification_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Uganda',
  currency TEXT NOT NULL DEFAULT 'UGX',
  timezone TEXT NOT NULL DEFAULT 'Africa/Kampala',
  logo_url TEXT,
  website TEXT,
  receipt_prefix TEXT NOT NULL DEFAULT 'RCP',
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  footer_text TEXT,
  payment_instructions TEXT,
  tax_display_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT businesses_status_valid CHECK (status IN ('active','suspended','closed'))
);

CREATE TABLE IF NOT EXISTS business_memberships (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT memberships_role_valid CHECK (role IN ('owner','administrator','finance_manager','accountant','sales_officer','cashier','viewer')),
  CONSTRAINT memberships_business_user_uq UNIQUE (business_id, user_id),
  CONSTRAINT memberships_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT memberships_user_fk FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON business_memberships(user_id);
CREATE INDEX IF NOT EXISTS memberships_business_idx ON business_memberships(business_id);

CREATE TABLE IF NOT EXISTS document_sequences (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  last_number NUMERIC(18,0) NOT NULL DEFAULT '0',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_sequences_type_valid CHECK (document_type IN ('invoice','receipt')),
  CONSTRAINT document_sequences_business_type_uq UNIQUE (business_id, document_type),
  CONSTRAINT document_sequences_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS document_sequences_business_idx ON document_sequences(business_id);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  idempotency_key TEXT,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  amount NUMERIC(18,2) NOT NULL,
  reason TEXT,
  method TEXT,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT refunds_status_valid CHECK (status IN ('pending','approved','completed','rejected')),
  CONSTRAINT refunds_amount_positive CHECK (amount > 0),
  CONSTRAINT refunds_payment_fk FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT refunds_requested_by_fk FOREIGN KEY (business_id, requested_by) REFERENCES business_memberships(business_id, user_id) ON DELETE CASCADE,
  CONSTRAINT refunds_approved_by_fk FOREIGN KEY (approved_by) REFERENCES "user"(id) ON DELETE SET NULL,
  CONSTRAINT refunds_idempotency_key_business_uq UNIQUE (business_id, idempotency_key) WHERE idempotency_key IS NOT NULL
);

CREATE INDEX IF NOT EXISTS refunds_payment_idx ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS refunds_business_idx ON refunds(business_id);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON refunds(status);

-- ------------------------------------------------------------------
-- 2. Add business_id to existing owned tables (nullable for backfill)
-- ------------------------------------------------------------------

ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'issued';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS voided_by TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS business_id TEXT;

-- ------------------------------------------------------------------
-- 3. Composite foreign keys (business_id + user_id / customer_id)
-- ------------------------------------------------------------------

-- customers: business_id + user_id -> business_memberships(business_id, user_id)
ALTER TABLE customers
  ADD CONSTRAINT customers_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE CASCADE;

-- catalogue_items: business_id + user_id -> business_memberships
ALTER TABLE catalogue_items
  ADD CONSTRAINT catalogue_items_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE CASCADE;

-- invoices: business_id + customer_id -> customers(business_id, id)
ALTER TABLE invoices
  ADD CONSTRAINT invoices_customer_business_fk
  FOREIGN KEY (business_id, customer_id) REFERENCES customers(business_id, id);

-- invoices: business_id + user_id -> business_memberships
ALTER TABLE invoices
  ADD CONSTRAINT invoices_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE CASCADE;

-- invoice_items: business_id + invoice_id -> invoices(business_id, id)
ALTER TABLE invoice_items
  ADD CONSTRAINT invoice_items_invoice_business_fk
  FOREIGN KEY (business_id, invoice_id) REFERENCES invoices(business_id, id) ON DELETE CASCADE;

-- invoice_items: business_id + catalogue_item_id -> catalogue_items(business_id, id)
ALTER TABLE invoice_items
  ADD CONSTRAINT invoice_items_catalogue_business_fk
  FOREIGN KEY (business_id, catalogue_item_id) REFERENCES catalogue_items(business_id, id) ON DELETE SET NULL;

-- payments: business_id + customer_id -> customers(business_id, id)
ALTER TABLE payments
  ADD CONSTRAINT payments_customer_business_fk
  FOREIGN KEY (business_id, customer_id) REFERENCES customers(business_id, id);

-- payments: business_id + user_id -> business_memberships
ALTER TABLE payments
  ADD CONSTRAINT payments_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE CASCADE;

-- receipts: business_id + payment_id -> payments(business_id, id)
ALTER TABLE receipts
  ADD CONSTRAINT receipts_payment_business_fk
  FOREIGN KEY (business_id, payment_id) REFERENCES payments(business_id, id);

-- receipts: business_id + user_id -> business_memberships
ALTER TABLE receipts
  ADD CONSTRAINT receipts_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE CASCADE;

-- receipts: voided_by -> user(id)
ALTER TABLE receipts
  ADD CONSTRAINT receipts_voided_by_fk
  FOREIGN KEY (voided_by) REFERENCES "user"(id) ON DELETE SET NULL;

-- expenses: business_id + user_id -> business_memberships
ALTER TABLE expenses
  ADD CONSTRAINT expenses_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE CASCADE;

-- audit_logs: business_id + user_id -> business_memberships
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_business_user_fk
  FOREIGN KEY (business_id, user_id) REFERENCES business_memberships(business_id, user_id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- 4. Unique constraints
-- ------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_business_uq ON invoices(business_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_number_business_uq ON receipts(business_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_business_uq ON payments(business_id, reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_business_uq ON payments(business_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ------------------------------------------------------------------
-- 5. Check constraints
-- ------------------------------------------------------------------

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_valid CHECK (status IN ('draft','issued','partially_paid','paid','overdue','cancelled')),
  ADD CONSTRAINT invoices_total_nonnegative CHECK (total >= 0),
  ADD CONSTRAINT invoices_amount_paid_nonnegative CHECK (amount_paid >= 0);

ALTER TABLE invoice_items
  ADD CONSTRAINT invoice_items_quantity_positive CHECK (quantity > 0),
  ADD CONSTRAINT invoice_items_unit_price_nonnegative CHECK (unit_price >= 0),
  ADD CONSTRAINT invoice_items_line_total_nonnegative CHECK (line_total >= 0);

ALTER TABLE payments
  ADD CONSTRAINT payments_method_valid CHECK (method IN ('cash','bank_transfer','mobile_money','card','cheque','other')),
  ADD CONSTRAINT payments_status_valid CHECK (status IN ('confirmed','pending','failed','reversed')),
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

ALTER TABLE payment_allocations
  ADD CONSTRAINT payment_allocations_amount_positive CHECK (amount > 0);

-- payment_allocations foreign keys with business scoping
ALTER TABLE payment_allocations ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE payment_allocations
  ADD CONSTRAINT payment_allocations_payment_business_fk
  FOREIGN KEY (business_id, payment_id) REFERENCES payments(business_id, id) ON DELETE CASCADE;
ALTER TABLE payment_allocations
  ADD CONSTRAINT payment_allocations_invoice_business_fk
  FOREIGN KEY (business_id, invoice_id) REFERENCES invoices(business_id, id);

CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS payment_allocations_invoice_idx ON payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS payment_allocations_business_idx ON payment_allocations(business_id);

ALTER TABLE receipts
  ADD CONSTRAINT receipts_status_valid CHECK (status IN ('issued','voided'));

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS customers_business_idx ON customers(business_id);
CREATE INDEX IF NOT EXISTS customers_user_idx ON customers(user_id);
CREATE INDEX IF NOT EXISTS catalogue_items_business_idx ON catalogue_items(business_id);
CREATE INDEX IF NOT EXISTS catalogue_items_user_idx ON catalogue_items(user_id);
CREATE INDEX IF NOT EXISTS invoices_business_idx ON invoices(business_id);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_items_business_idx ON invoice_items(business_id);
CREATE INDEX IF NOT EXISTS payments_business_idx ON payments(business_id);
CREATE INDEX IF NOT EXISTS payments_customer_idx ON payments(customer_id);
CREATE INDEX IF NOT EXISTS payments_idempotency_idx ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON payments(user_id, paid_at);
CREATE INDEX IF NOT EXISTS receipts_business_idx ON receipts(business_id);
CREATE INDEX IF NOT EXISTS receipts_payment_idx ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS receipts_status_idx ON receipts(status);
CREATE INDEX IF NOT EXISTS expenses_business_idx ON expenses(business_id);
CREATE INDEX IF NOT EXISTS expenses_user_idx ON expenses(user_id);
CREATE INDEX IF NOT EXISTS expenses_paid_at_idx ON expenses(user_id, paid_at);
CREATE INDEX IF NOT EXISTS audit_logs_business_idx ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);

-- ------------------------------------------------------------------
-- Note: business_id columns are intentionally left nullable in this
-- migration so existing records are not invalidated. Application code
-- and a follow-up backfill migration populate business_id from the
-- user's business membership before NOT NULL enforcement.

-- Migration 0013: Service Desk Module
--
-- Adds service desk functionality with client portal support.
-- All changes are additive and backward-compatible.
-- Tables: service_tickets, service_ticket_comments, service_ticket_events,
--         service_ticket_attachments, service_level_policies, business_invitations

-- ------------------------------------------------------------------
-- 1. Create service_tickets table
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS service_tickets (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assignee_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  related_invoice_id TEXT,
  related_quotation_id TEXT,
  related_service_order_id TEXT,
  sla_policy_id TEXT,
  created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  CONSTRAINT service_tickets_status_valid CHECK (status IN ('open','in_progress','on_hold','resolved','closed','cancelled')),
  CONSTRAINT service_tickets_priority_valid CHECK (priority IN ('low','normal','high','critical','urgent')),
  CONSTRAINT service_tickets_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  CONSTRAINT service_tickets_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT service_tickets_invoice_fk FOREIGN KEY (related_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  CONSTRAINT service_tickets_quotation_fk FOREIGN KEY (related_quotation_id) REFERENCES quotations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS service_tickets_business_idx ON service_tickets(business_id);
CREATE INDEX IF NOT EXISTS service_tickets_customer_idx ON service_tickets(customer_id);
CREATE INDEX IF NOT EXISTS service_tickets_status_idx ON service_tickets(status);
CREATE INDEX IF NOT EXISTS service_tickets_priority_idx ON service_tickets(priority);
CREATE INDEX IF NOT EXISTS service_tickets_assignee_idx ON service_tickets(assignee_user_id);
CREATE INDEX IF NOT EXISTS service_tickets_created_by_idx ON service_tickets(created_by);
CREATE INDEX IF NOT EXISTS service_tickets_created_at_idx ON service_tickets(created_at);

-- ------------------------------------------------------------------
-- 2. Create service_ticket_comments table
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS service_ticket_comments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_ticket_comments_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  CONSTRAINT service_ticket_comments_ticket_fk FOREIGN KEY (ticket_id) REFERENCES service_tickets(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS service_ticket_comments_business_idx ON service_ticket_comments(business_id);
CREATE INDEX IF NOT EXISTS service_ticket_comments_ticket_idx ON service_ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS service_ticket_comments_author_idx ON service_ticket_comments(author_user_id);
CREATE INDEX IF NOT EXISTS service_ticket_comments_created_at_idx ON service_ticket_comments(created_at);

-- ------------------------------------------------------------------
-- 3. Create service_ticket_events table (immutable audit trail)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS service_ticket_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_ticket_events_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  CONSTRAINT service_ticket_events_ticket_fk FOREIGN KEY (ticket_id) REFERENCES service_tickets(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS service_ticket_events_business_idx ON service_ticket_events(business_id);
CREATE INDEX IF NOT EXISTS service_ticket_events_ticket_idx ON service_ticket_events(ticket_id);
CREATE INDEX IF NOT EXISTS service_ticket_events_actor_idx ON service_ticket_events(actor_user_id);
CREATE INDEX IF NOT EXISTS service_ticket_events_created_at_idx ON service_ticket_events(created_at);
CREATE INDEX IF NOT EXISTS service_ticket_events_type_idx ON service_ticket_events(event_type);

-- ------------------------------------------------------------------
-- 4. Create service_ticket_attachments table
-- ------------------------------------------------------------------
-- Note: Requires persistent object storage (S3-compatible).
-- Uploads stored externally; this table tracks metadata only.

CREATE TABLE IF NOT EXISTS service_ticket_attachments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_url TEXT NOT NULL,
  checksum_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_ticket_attachments_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  CONSTRAINT service_ticket_attachments_ticket_fk FOREIGN KEY (ticket_id) REFERENCES service_tickets(id) ON DELETE RESTRICT,
  CONSTRAINT service_ticket_attachments_size_positive CHECK (size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS service_ticket_attachments_business_idx ON service_ticket_attachments(business_id);
CREATE INDEX IF NOT EXISTS service_ticket_attachments_ticket_idx ON service_ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS service_ticket_attachments_uploaded_by_idx ON service_ticket_attachments(uploaded_by);

-- ------------------------------------------------------------------
-- 5. Create service_level_policies table
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS service_level_policies (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  response_minutes INTEGER NOT NULL DEFAULT 60,
  resolution_minutes INTEGER NOT NULL DEFAULT 480,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  applies_to_priorities TEXT[] NOT NULL DEFAULT ARRAY['low','normal','high','critical','urgent'],
  business_hours_only BOOLEAN NOT NULL DEFAULT TRUE,
  timezone TEXT NOT NULL DEFAULT 'Africa/Kampala',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_level_policies_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  CONSTRAINT service_level_policies_response_positive CHECK (response_minutes > 0),
  CONSTRAINT service_level_policies_resolution_positive CHECK (resolution_minutes > 0)
);

CREATE INDEX IF NOT EXISTS service_level_policies_business_idx ON service_level_policies(business_id);
CREATE INDEX IF NOT EXISTS service_level_policies_business_default_idx ON service_level_policies(business_id, is_default);

-- Add the SLA foreign key after the referenced table exists.
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_tickets_sla_fk'
      AND conrelid = 'service_tickets'::regclass
  ) THEN
    ALTER TABLE service_tickets
      ADD CONSTRAINT service_tickets_sla_fk
      FOREIGN KEY (sla_policy_id) REFERENCES service_level_policies(id) ON DELETE SET NULL;
  END IF;
END
$;


-- ------------------------------------------------------------------
-- 6. Create business_invitations table
-- ------------------------------------------------------------------
-- Single-use, expiring, email-bound invitations for client portal access

CREATE TABLE IF NOT EXISTS business_invitations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  token_hash TEXT NOT NULL,
  invited_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_invitations_business_fk FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  CONSTRAINT business_invitations_role_valid CHECK (role IN ('owner','administrator','finance_manager','accountant','sales_officer','cashier','viewer')),
  CONSTRAINT business_invitations_status_valid CHECK (status IN ('pending','accepted','expired','revoked')),
  CONSTRAINT business_invitations_email_business_uq UNIQUE (business_id, email)
);

CREATE INDEX IF NOT EXISTS business_invitations_business_idx ON business_invitations(business_id);
CREATE INDEX IF NOT EXISTS business_invitations_email_idx ON business_invitations(email);
CREATE INDEX IF NOT EXISTS business_invitations_token_hash_idx ON business_invitations(token_hash);
CREATE INDEX IF NOT EXISTS business_invitations_status_idx ON business_invitations(status);
CREATE INDEX IF NOT EXISTS business_invitations_expires_at_idx ON business_invitations(expires_at);

-- ------------------------------------------------------------------
-- 7. Add document sequence type for service_ticket
-- ------------------------------------------------------------------

INSERT INTO document_sequences (id, business_id, document_type, last_number, updated_at)
SELECT gen_random_uuid(), b.id, 'service_ticket', '0', NOW()
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM document_sequences ds
  WHERE ds.business_id = b.id AND ds.document_type = 'service_ticket'
);

-- ------------------------------------------------------------------
-- 8. Add service_ticket prefix to businesses (optional, defaults to 'ST')
-- ------------------------------------------------------------------

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS service_ticket_prefix TEXT NOT NULL DEFAULT 'ST';
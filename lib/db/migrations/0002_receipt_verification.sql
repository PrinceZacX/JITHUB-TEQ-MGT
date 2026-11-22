-- Migration 0002: Receipt verification tokens
--
-- Adds a unique verification_token to receipts for public QR-based
-- receipt verification. The token is a cryptographically secure hash
-- and is not guessable.

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS verification_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS receipts_verification_token_uq ON receipts(verification_token) WHERE verification_token IS NOT NULL;

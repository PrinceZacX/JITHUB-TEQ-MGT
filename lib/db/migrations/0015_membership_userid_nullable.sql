-- Migration 0015: Make business_memberships.userId nullable
--
-- Allows invited members (who don't have a user account yet) to have a
-- membership row with a NULL userId. The membership is completed when the
-- invited person signs up and their user record is linked.
--
-- All changes are additive and backward-compatible.

ALTER TABLE business_memberships ALTER COLUMN user_id DROP NOT NULL;
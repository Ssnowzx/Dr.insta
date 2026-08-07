-- =============================================================================
-- 006 — What she agreed to, recorded with the credential
--
-- Consent that leaves no trace is indistinguishable from consent that was never
-- asked for. The screen already explained what would be read; this records that
-- she saw it, when, and WHICH version of it — because the text will change the
-- day the scopes change, and "she agreed" is worthless without "to what".
--
-- Stored on the connection rather than only in the audit log: the agreement and
-- the credential it authorises belong together, and disconnecting takes both.
-- The audit row survives separately as the historical fact.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


ALTER TABLE instagram_connection
  -- The version she accepted, not a boolean. A flag would still read "agreed"
  -- after the terms were rewritten, which is the failure mode this prevents.
  ADD COLUMN terms_version VARCHAR(20) DEFAULT NULL AFTER scopes,
  ADD COLUMN terms_accepted_at DATETIME DEFAULT NULL AFTER terms_version;

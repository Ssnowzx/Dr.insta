-- =============================================================================
-- 005 — The client's own Instagram account, connected by her
--
-- WHY THIS TABLE EXISTS
--
-- Every number in this product arrives because Bianca remembered to export a
-- file. Four of the five open requests on her screen are "just send me a
-- number", and the oldest — the spreadsheet of 203 Reels — has been open since
-- 5 August and is labelled "the one that unblocks the most". While it does not
-- arrive, the cycle cannot be read.
--
-- Worse: the number that decides the cycle is the one we cannot get. Experiment
-- a1 swapped the bio link for a tagged one, and what settles it is bio link
-- clicks — recorded today as 0, baseline 30/07/2026. The official API returns
-- exactly that, as `profile_links_taps`, every day, asking her for nothing.
--
-- WHAT IS STORED, AND WHAT IS DELIBERATELY NOT
--
-- The access token is stored ENCRYPTED (AES-256-GCM, key outside the database).
-- A dump of this table must not be enough to act on her account. Nothing here
-- is ever rendered on a screen or written to a log.
--
-- One connection per client, enforced by a unique key rather than by whoever
-- writes the insert. A second row would mean two tokens for one account and no
-- rule about which is current.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


CREATE TABLE instagram_connection (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code           CHAR(26)        NOT NULL,
  client_id             BIGINT UNSIGNED NOT NULL,

  -- Identity of the connected account, as the API reports it. `username` is a
  -- copy taken at connection time and may go stale: she can rename the account
  -- and the id will not change. It exists so a screen can say which account is
  -- connected without spending a request.
  ig_user_id            VARCHAR(32)     NOT NULL,
  username              VARCHAR(80)             DEFAULT NULL,

  -- `iv:authTag:ciphertext`, base64. TEXT and not VARCHAR because the token is
  -- long and the encoding grows it further.
  access_token          TEXT                    DEFAULT NULL,
  token_expires_at      DATETIME                DEFAULT NULL,

  -- What she actually granted, recorded verbatim. If we ever need a scope we
  -- did not ask for, the fix is to ask her again — and this is how we know.
  scopes                VARCHAR(255)            DEFAULT NULL,

  -- Who authorised. A client user, always: the token belongs to whoever sat in
  -- front of the Instagram login screen.
  connected_by          BIGINT UNSIGNED         DEFAULT NULL,
  connected_at          DATETIME                DEFAULT NULL,
  last_refresh_at       DATETIME                DEFAULT NULL,

  -- When the numbers were last actually collected. This is shown next to the
  -- numbers themselves: a connection that quietly stops working looks exactly
  -- like a month where nothing happened.
  last_sync_at          DATETIME                DEFAULT NULL,

  -- `failing` is not `expired`: the credential may still be valid while the
  -- collection keeps erroring. Collapsing the two would tell her to reconnect
  -- when reconnecting fixes nothing.
  state                 ENUM('active','expired','revoked','failing')
                        NOT NULL DEFAULT 'active',
  last_error            VARCHAR(255)            DEFAULT NULL,
  last_error_at         DATETIME                DEFAULT NULL,

  created_at            DATETIME        NOT NULL,
  updated_at            DATETIME        NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_ig_connection_code (public_code),
  -- One account per client. See the header.
  UNIQUE KEY uq_ig_connection_client (client_id),
  KEY ix_ig_connection_state (state, token_expires_at),
  CONSTRAINT fk_ig_connection_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE CASCADE,
  -- The connection outlives the person who made it. Deleting a user must not
  -- silently disconnect the account.
  CONSTRAINT fk_ig_connection_user FOREIGN KEY (connected_by)
    REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- A number collected by machine is not the same kind of number as one a person
-- read off a screen and typed. `insights` keeps its meaning — transcribed from
-- the app — and `api` means the official source answered.
--
-- The unique key on metric_value already includes `source`, so the two coexist
-- by design. That is how July revenue exists twice, `store` 10,583.28 and
-- `manual` 12,700. What changes is that now they can collide on the SAME
-- metric, so the screen needs a declared precedence — see lib/precedencia.ts.
ALTER TABLE metric_value
  MODIFY COLUMN source ENUM('api','insights','ga4','store','public','manual') NOT NULL;

-- =============================================================================
-- 002 — When a consultant last read the news
--
-- The daily summary used to arrive by email. That was dropped: everything
-- happens inside the platform now, so the consultant reads what changed on a
-- screen instead of in an inbox.
--
-- A screen needs a "since when" marker, and `user.last_seen_at` cannot be it:
-- that column advances on every sign-in, so opening the app would silently mark
-- everything as read without anyone having looked at it.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE user
  ADD COLUMN news_seen_at DATETIME NULL
  COMMENT 'when this user last opened the activity screen; NULL means never'
  AFTER last_seen_at;

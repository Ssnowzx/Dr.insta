-- =============================================================================
-- 004 — The sentence that goes next to a value she has to paste
--
-- She read the tagged bio link and said it was long and ugly on her profile.
-- Two things are true at once, and neither was on the screen:
--
--   · what she is seeing is the EDIT field. Measured on her profile the same
--     day: Instagram displays `www.myfavorite.com.br` and nothing else — the
--     query string is truncated in the public view, so the tag is already
--     invisible to everyone but her
--   · she is still right that it is unpleasant to manage, and a shorter path on
--     her own domain would be better in every way — but that one depends on a
--     redirect in the store, and until it exists a shortened link in her bio is
--     a 404, which is far worse than a long one
--
-- A step could carry that in its `summary`, but the summary answers "why does
-- this matter" and is read before the value appears. This is a note ABOUT the
-- value: it only makes sense once she is looking at the string and wondering
-- what it is. Different question, different moment, its own column.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE step
  ADD COLUMN copy_note TEXT NULL
    COMMENT 'pt-BR: what to know about the pasted value — why it looks odd, what not to do'
    AFTER copy_label;

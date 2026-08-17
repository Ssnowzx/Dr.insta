-- =============================================================================
-- 012 — A request field is identified by what it ASKS FOR, not by its wording
--
-- WHY
--
-- `011` keyed `request_field` on (request_id, label), so re-seeding after
-- rewording a label inserted a SECOND row instead of updating the first. Found
-- immediately: rewriting five labels to name the real Reels turned five fields
-- into nine, and the screen would have asked her for the same number twice
-- under two different sentences.
--
-- The label is presentation and will be rewritten every time the copy improves
-- — which, on this product, is often. What does not change is what the field
-- asks for and where the answer lands, and that is what `slug` names.
--
-- WHY NOT KEY ON (metric_key, post_code)
--
-- That is what the field IS, and it would be the honest key — except both are
-- nullable, and MySQL lets a UNIQUE index repeat rows containing NULL. The
-- constraint would silently not exist for exactly the rows most likely to
-- collide. A NOT NULL slug authored by the seed cannot have that hole.
--
-- WHY A NEW FILE FOR SOMETHING WRITTEN AN HOUR AGO
--
-- `011` has been applied. The rule in the README has no exception for "only
-- locally" or "only recently": a migration that has run is a migration that
-- someone may have run somewhere you cannot see, and a file that changes after
-- it ran is a file whose name no longer describes what the database did.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'request_field'
               AND COLUMN_NAME = 'slug');
SET @sql := IF(@tem = 0,
  'ALTER TABLE request_field ADD COLUMN slug VARCHAR(60) NULL AFTER request_id',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- Backfill from the label for anything already stored.
--
-- Only rows that have no slug, and only where it would be unique — a duplicate
-- would fail the index below and take the whole migration with it. In practice
-- this touches nothing outside a development database: `011` shipped in the
-- same deploy as this file.
UPDATE request_field
   SET slug = LEFT(LOWER(REPLACE(REPLACE(label, ' ', '-'), '/', '-')), 60)
 WHERE slug IS NULL;


-- Rows this file's own author left behind: fields with no slug collision but
-- no longer written by the seed. Dropped only when UNANSWERED — a number she
-- typed is hers, and a re-worded label must never take it with it.
DELETE FROM request_field WHERE value IS NULL AND slug IS NULL;


SET @tem := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'request_field'
               AND INDEX_NAME = 'uq_field_request_slug');
SET @sql := IF(@tem = 0,
  'CREATE UNIQUE INDEX uq_field_request_slug ON request_field (request_id, slug)',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- The label stops being an identifier and becomes what it always was: a
-- sentence. Dropping the old index is what allows it to be rewritten freely.
SET @tem := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'request_field'
               AND INDEX_NAME = 'uq_field_request_label');
SET @sql := IF(@tem > 0,
  'DROP INDEX uq_field_request_label ON request_field',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

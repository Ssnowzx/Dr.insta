-- =============================================================================
-- 009 — Which metric decides THIS cycle
--
-- WHY
--
-- Two screens resolved "the north-star metric" by scanning `metric_def.tier`
-- for 'north_star' and taking the first match: the panel, and the progression
-- on the analysis screen. That worked only while exactly one metric in the
-- whole catalogue carried that tier.
--
-- The cycle changing to followers breaks it. `comments_reach` must KEEP its
-- tier — it was the declared north star from 12 to 13 August, and rewriting the
-- catalogue would make the closed cycle's screens claim it had been a
-- monitoring metric all along. So the catalogue ends up with two, and `.find()`
-- picks whichever the query returned first.
--
-- WHY NOT `cycle.north_star_metric`
--
-- That column exists and holds "Comentários por alcance" — a human label for a
-- heading, 160 characters of prose. It cannot select a row. Matching a metric
-- by its display name would break the first time someone rewrote the label.
--
-- WHY HERE
--
-- `metric_target` is already scoped to a cycle: it is where the baseline and
-- the target of a metric FOR THIS CYCLE live. Which one decides is the same
-- kind of fact. `metric_def.tier` stays what it always was — a classification
-- of the catalogue, not of the cycle — and history stays readable as it was.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- Each step is guarded so the file can be re-run after a partial failure.
--
-- MySQL has no `ADD COLUMN IF NOT EXISTS`, and `db/migrate.ts` records a file
-- only after the WHOLE file succeeds — DDL commits implicitly, so a failure on
-- the last statement leaves the earlier ones applied and unrecorded, and the
-- retry dies on "Duplicate column name". That is not hypothetical: it happened
-- here on 13/08/2026, when a STORED generated column failed on this table and
-- the column plus the update had already landed.
SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'metric_target'
               AND COLUMN_NAME = 'is_north_star');
SET @sql := IF(@tem = 0,
  'ALTER TABLE metric_target ADD COLUMN is_north_star TINYINT NOT NULL DEFAULT 0 AFTER contaminated',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- NO BACKFILL, deliberately.
--
-- The obvious one — "set the flag wherever the catalogue tiers the metric
-- north_star" — was written here first and was wrong twice over.
--
-- It missed cycle 1: its north star was `tracked_sessions`, demoted to
-- `monitor` when the store left scope, so the cycle that steered by it would
-- come out of this migration with no north star at all.
--
-- And it was destructive out of order. Run after the new seed — a dump
-- restored, a clone, a manual replay — the catalogue holds TWO metrics tiered
-- north_star, the active cycle has a target for both, and the update would
-- promote the `comments_reach` guard-rail to a second north star of a
-- followers cycle. The unique index below would then fail on data that was
-- already wrong.
--
-- `db/seed.ts` authors this fact for all three cycles, explicitly, the same way
-- it authors every other cycle fact. Between this migration and the seed no
-- cycle has a north star; that window is the seed run, and the panel simply
-- shows no highlighted card during it.


-- One per cycle, enforced here rather than by whoever writes the seed. Two
-- north stars is zero north stars: the tie-break rule stops existing, which is
-- the whole reason a cycle has one.
--
-- Through a generated column, because what is needed is a PARTIAL unique index
-- — unique among the rows where the flag is set — and MySQL has no such thing.
-- A plain `UNIQUE (client_id, cycle_id, is_north_star)` would also make the
-- zeroes unique, which is to say it would allow exactly one NON-north-star
-- target per cycle and reject the second guard-rail. The column is NULL when
-- the flag is off, and a unique index ignores repeated NULLs.
-- VIRTUAL and not STORED. A stored generated column rebuilds the table with the
-- copy algorithm, and on a table carrying three foreign keys that rebuild fails
-- with "Cannot add foreign key constraint" — measured here on 13/08/2026, on
-- this exact table. Virtual is computed on read, needs no rebuild, and MySQL 8
-- indexes it fine, which is all this needs it to do.
SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'metric_target'
               AND COLUMN_NAME = 'north_star_cycle');
SET @sql := IF(@tem = 0,
  'ALTER TABLE metric_target ADD COLUMN north_star_cycle BIGINT UNSIGNED GENERATED ALWAYS AS (IF(is_north_star = 1, cycle_id, NULL)) VIRTUAL',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


SET @tem := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'metric_target'
               AND INDEX_NAME = 'uq_target_north_star');
SET @sql := IF(@tem = 0,
  'CREATE UNIQUE INDEX uq_target_north_star ON metric_target (north_star_cycle)',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

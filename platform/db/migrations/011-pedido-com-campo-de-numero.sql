-- =============================================================================
-- 011 — A request can ask for a number, and the number lands by itself
--
-- WHY
--
-- Traced on 17/08/2026, because the question was asked directly: what she sends
-- in Pedidos, is it processed automatically? It is not. `metric_value` is
-- written by exactly three things — the seed, the Reels importer and the
-- Instagram sync — and the `file` table is read by exactly one route, the
-- download. There is no OCR and nothing parses an upload.
--
-- So a screenshot of Insights arrives, is announced, and stops. A person opens
-- it, reads the figure and types it in somewhere else. The intake is automated
-- and the processing is a human being, which is fine for a photo of a retention
-- curve and absurd for a single integer.
--
-- WHY A FIELD AND NOT OCR
--
-- OCR over a screenshot of Insights misreads digits, and a misread figure that
-- enters the panel on its own is worse than one that waits a day: nobody
-- distrusts it. A typed number is checked by the person who can see the screen
-- it came from, parsed by a rule that refuses what it cannot read
-- (`lib/numero.ts`), and echoed back for confirmation.
--
-- WHY A TABLE AND NOT A COLUMN ON `request`
--
-- The two requests this exists for have different shapes. "Visitas ao perfil"
-- is one number a month. "A aba Público de cinco Reels" is FIVE numbers, one
-- per Reel, each belonging to a different post. A single `answer_value` column
-- would serve the first and force the second back into an attachment.
--
-- WHERE THE ANSWER GOES
--
-- Two destinations, as an enum rather than a column name in a string. A stored
-- column name is an injection surface and, worse, a magic value nobody
-- validates — the day someone seeds `post_column = 'reach'` the archive gets a
-- reach that was typed rather than measured, which is the one thing this schema
-- has refused since the first migration.
--
--   metric      -> metric_value, source `insights`, keyed by `metric_key`
--   post_share  -> post.non_follower_pct, keyed by the shortcode
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- The share of a post's reach that was NOT already following her.
--
-- The honest denominator for follower conversion, and the number the whole
-- cycle's 41x finding rests on: someone who already follows cannot follow
-- again, so normalising by total reach mixes the people who could convert with
-- the people who could not. `CLAUDE.md` states the rule; nothing until now
-- could store the number.
--
-- Not derivable and not collectable: the API does not expose the follower /
-- non-follower split of an audience. It exists only on the Público tab of each
-- Reel, on her phone. That is why the request exists at all.
--
-- A ratio, like every other ratio here — never a pre-formatted percentage.
SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'post'
               AND COLUMN_NAME = 'non_follower_pct');
SET @sql := IF(@tem = 0,
  'ALTER TABLE post ADD COLUMN non_follower_pct DECIMAL(6,5) NULL AFTER retention_pct',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


CREATE TABLE IF NOT EXISTS request_field (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id  BIGINT UNSIGNED NOT NULL,
  position    SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  -- What to type, in her words. "O Reel dos perfumes (21/05)".
  label       VARCHAR(160) NOT NULL,
  -- Where to read it. The path inside Instagram, not a description of it — the
  -- lesson `step.copy_value` paid for: naming a thing instead of handing it
  -- over got the wrong thing pasted.
  hint        VARCHAR(255) NULL,
  unit        ENUM('count','ratio') NOT NULL DEFAULT 'count',

  -- Where the answer lands. See the header.
  target      ENUM('metric','post_share') NOT NULL DEFAULT 'metric',
  -- For `metric`: which one, by `metric_def.metric_key`.
  metric_key  VARCHAR(60) NULL,
  -- For `metric`: which month, as `YYYY-MM-01`. NULL means "the month it is
  -- answered in", resolved at write time — a monthly ask should not need the
  -- seed edited every month.
  period      DATE NULL,
  -- For `post_share`: which post, by the shortcode in its permalink. The same
  -- identifier the archive and the collector agree on.
  post_code   VARCHAR(40) NULL,

  -- What she typed, in stored form: a count as itself, a ratio as a ratio.
  -- NULL means unanswered, which is what the screen reads to know what is left.
  value       DECIMAL(16,6) NULL,
  answered_at DATETIME NULL,
  answered_by BIGINT UNSIGNED NULL,

  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL,

  PRIMARY KEY (id),
  -- One field per label per request, so re-seeding updates rather than adds.
  UNIQUE KEY uq_field_request_label (request_id, label),
  KEY ix_field_request (request_id, position),
  CONSTRAINT fk_field_request FOREIGN KEY (request_id) REFERENCES request (id) ON DELETE CASCADE,
  CONSTRAINT fk_field_user FOREIGN KEY (answered_by) REFERENCES user (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;


-- `value` stays here as well as being written to its destination, and that is
-- not duplication.
--
-- It is the record of WHAT SHE TYPED, with who and when. The destination holds
-- the number as one measurement among several sources — `metric_value` is
-- unique per source precisely because Insights and the API disagree — and a
-- later collection may overwrite it. Keeping her answer means "she said 347.482
-- on 17/08" survives the API replacing it, which is the disagreement this
-- schema exists to surface rather than hide.

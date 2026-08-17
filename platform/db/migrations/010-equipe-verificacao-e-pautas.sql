-- =============================================================================
-- 010 — Two people on the client side, a chore that can prove itself, and the
--       scripts she records from
--
-- Three things arrive together because they are one complaint:
-- "coisas que ela já fez continuam no app, e isso confunde".
--
-- WHY 1 — THE PLAN WAS PRIVATE TO ONE PERSON
--
-- `step_status` is unique on (step_id, user_id) and every query joined it on the
-- reader's own id. With exactly one client user that was invisible. With an
-- assistant it is a defect on day one: Bianca marks "feito", Cris opens the same
-- screen and reads "a fazer", and the two of them do the same chore twice or
-- neither does it. The rows stay per-person — who answered is worth keeping —
-- but the EFFECTIVE state of a step becomes the team's, resolved in
-- `lib/verificacao.ts`. No schema change is needed for that half.
--
-- What is needed here is a way to say WHICH person, because "Acesso dela" and
-- "Ela ainda não marcou este" stop being true the moment there are two.
--
-- WHY 2 — A CHORE THAT THE PLATFORM COULD ALREADY SEE WAS DONE
--
-- Step `c1` ("me mandar a aba Público de cinco Reels") and request #32 ("A aba
-- Público de cinco Reels") are the SAME job on two screens with no link between
-- them. She answers it in Pedidos, and Plano goes on asking. The same shape
-- applies to connecting the Instagram: `instagram_connection.state = 'active'`
-- is the platform watching the fact happen, and the plan asked anyway.
--
-- So a step gets two optional ways to prove itself:
--
--   · `request_id` — this chore IS that request. It is done when the request has
--     left `open`, because that is exactly when she has delivered her side.
--   · `verify_key` — a fact the platform observes on its own. Today the only
--     value is `instagram_connected`. The key is a string and not an enum: a new
--     verifier is code plus a seed line, and an enum would make it a migration
--     as well, which is how a mechanism this small stops being used.
--
-- Both are NULL by default. A step with neither behaves exactly as before —
-- there is no "everything is now automatic" moment to get wrong.
--
-- WHY 3 — PAUTAS AND ROTEIROS
--
-- She publishes ~8 Reels a week and writes everything herself. The cycle's whole
-- finding is that ONE kind of video converts — long, her opinion, her subject:
-- 3.131 followers against 45, at comparable reach. That video is the one that
-- needs a script; the rest is the spontaneous distribution engine and scripting
-- it would break the thing that works.
--
-- `idea` is a pauta with a date and a state. `idea_beat` is the script, beat by
-- beat, because "faça um vídeo de opinião" is not a script and she has an
-- assistant who needs something to follow. `idea_note` is the half that keeps
-- this honest: after it goes out, the two of them write back what happened, and
-- that text is what the next batch is written from.
--
-- WHY `idea_note` IS A SEPARATE TABLE
--
-- The same reason `step_status` is one. `db/seed.ts` re-authors every idea on
-- every run, and `onDuplicateKeyUpdate` lists every column the file writes. A
-- feedback column on `idea` would be erased by the next `npm run db:seed`,
-- silently, and the only evidence would be a note she remembers writing.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- Every step is guarded so the file survives a partial failure. MySQL has no
-- `ADD COLUMN IF NOT EXISTS`, DDL commits implicitly, and `db/migrate.ts` writes
-- its bookkeeping row only after the WHOLE file succeeds — so a failure on the
-- last statement leaves the earlier ones applied and unrecorded, and the retry
-- dies on "Duplicate column name". Measured on 13/08/2026, on migration 009.


-- ---------------------------------------------------------------- 1. the team

-- What this person does, in her own words, for the screens to say.
--
-- NOT a role and not a permission. The access rule stays what the README says it
-- is — `user.client_id` NULL means consultant, set means that client's user —
-- and a permission matrix is precisely what this column must not become. What
-- Cris may not do (disconnect Bianca's Instagram) is decided from a fact that
-- already exists: `instagram_connection.connected_by`.
SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'user'
               AND COLUMN_NAME = 'job_title');
SET @sql := IF(@tem = 0,
  'ALTER TABLE user ADD COLUMN job_title VARCHAR(80) NULL AFTER name',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- --------------------------------------------------- 2. a step that can prove itself

SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'step'
               AND COLUMN_NAME = 'request_id');
SET @sql := IF(@tem = 0,
  'ALTER TABLE step ADD COLUMN request_id BIGINT UNSIGNED NULL AFTER client_id',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- No foreign key, deliberately.
--
-- `db/seed.ts` writes steps and requests in one run and the order is not fixed;
-- a constraint here would make the seed order load-bearing. And a request that
-- is retired — the store report was, on 12/08 — must not take a delivered plan
-- down with it. The join is a LEFT one everywhere, so a dangling id degrades to
-- "this step verifies nothing", which is the old behaviour.
SET @tem := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'step'
               AND INDEX_NAME = 'ix_step_request');
SET @sql := IF(@tem = 0,
  'CREATE INDEX ix_step_request ON step (request_id)',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'step'
               AND COLUMN_NAME = 'verify_key');
SET @sql := IF(@tem = 0,
  'ALTER TABLE step ADD COLUMN verify_key VARCHAR(40) NULL AFTER request_id',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- NO BACKFILL, for the same reason 009 refused one.
--
-- The obvious line — "point every step whose title matches a request at that
-- request" — would guess at a relationship the person who wrote both already
-- knows. `db/seed.ts` authors it explicitly, one field per step, the way it
-- authors every other fact about a step.


-- -------------------------------------------------------------- 3. the pautas

CREATE TABLE IF NOT EXISTS idea (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code    CHAR(26) NOT NULL,
  client_id      BIGINT UNSIGNED NOT NULL,
  cycle_id       BIGINT UNSIGNED NULL,

  -- By `pillar.pillar_key`, not by id — the same choice `pillar.metric_key`
  -- makes, and for the same reason: the seed writes both in one run, and a pauta
  -- that names a pillar the cycle no longer has should read as an orphan rather
  -- than fail to insert.
  pillar_key     VARCHAR(40) NULL,

  title          VARCHAR(200) NOT NULL,
  -- The first three seconds, WRITTEN OUT and not described. `step.copy_value`
  -- learned this the expensive way: the step that named a tagged link instead of
  -- handing it over got the wrong link pasted into the bio, and nothing looked
  -- broken from her side. "Abra com um gancho forte" is that mistake again.
  hook           TEXT NULL,
  format         ENUM('reel','carrossel','story','foto') NOT NULL DEFAULT 'reel',
  -- The target length, in seconds. The cycle's finding is about duration as much
  -- as about subject: the 1–10s bucket converts at 0,061% against 0,146% for 90s+.
  target_seconds SMALLINT UNSIGNED NULL,

  -- Why this pauta exists, with the number behind it. A calendar she can only
  -- obey is a calendar she cannot disagree with, and disagreeing is what makes
  -- it hers — the same argument that put `pillar.thesis` on the plan screen.
  why            TEXT NULL,
  -- The suggested caption. 2 to 5 words, lowercase — see `perfil/voz-e-tom.md`.
  caption        TEXT NULL,
  -- What the video asks for at the end. Separate from the caption because the
  -- caption is her voice and this is the one line that has a job.
  cta            VARCHAR(200) NULL,

  -- The cronograma. NULL means it is in the bank rather than on a day, and the
  -- screen groups on exactly that.
  scheduled_for  DATE NULL,

  --   proposed  -> written, not scheduled
  --   scheduled -> it has a day
  --   recorded  -> filmed, not out yet
  --   published -> it is live; it leaves the working list
  --   dropped   -> she said no. Kept, because a pauta she rejected is the most
  --                useful thing in this table when writing the next batch.
  state          ENUM('proposed','scheduled','recorded','published','dropped')
                 NOT NULL DEFAULT 'proposed',
  -- Filled by hand when it goes out, so the pauta can later be read against the
  -- post it became. `post.ig_code` is the shortcode from the permalink, which is
  -- the only identifier both the public export and a person copying a link have.
  published_code VARCHAR(40) NULL,

  position       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL,
  updated_at     DATETIME NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_idea_code (public_code),
  -- Per client, so re-seeding updates the pauta instead of adding a second copy
  -- of it. `db/seed.ts` is run after every edit to the text.
  UNIQUE KEY uq_idea_client_title (client_id, title),
  KEY ix_idea_agenda (client_id, state, scheduled_for),
  CONSTRAINT fk_idea_client FOREIGN KEY (client_id) REFERENCES client (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;


-- The script, beat by beat.
--
-- Rows and not one TEXT column: the point of this table is that she can hold the
-- phone and read the next line, and a wall of prose is what she already fails to
-- follow. `says` is what comes out of her mouth; `shows` is what is on screen —
-- they are different instructions to different people, and the assistant reading
-- this is often not the one talking.
CREATE TABLE IF NOT EXISTS idea_beat (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idea_id    BIGINT UNSIGNED NOT NULL,
  position   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  -- "0–3s", "até o fim". A label and not two integers: some beats are "when she
  -- picks up the second bottle", which no pair of numbers can say.
  time_label VARCHAR(20) NULL,
  says       TEXT NOT NULL,
  shows      TEXT NULL,
  note       VARCHAR(255) NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_beat_position (idea_id, position),
  CONSTRAINT fk_beat_idea FOREIGN KEY (idea_id) REFERENCES idea (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;


-- What they write back.
--
-- Its own table so `npm run db:seed` cannot erase it — see the header. Both
-- sides write here: hers is "gravei e não funcionou, ficou longo demais", his is
-- the answer. `user_id` is who, and the digest reads it so a note does not sit
-- unread until someone thinks to open the pauta again.
CREATE TABLE IF NOT EXISTS idea_note (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idea_id    BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL,

  PRIMARY KEY (id),
  KEY ix_note_idea (idea_id, created_at),
  CONSTRAINT fk_note_idea FOREIGN KEY (idea_id) REFERENCES idea (id) ON DELETE CASCADE,
  CONSTRAINT fk_note_user FOREIGN KEY (user_id) REFERENCES user (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;


-- Who moved a pauta and when lives in `audit_log`, like every other state change
-- in this schema. `idea.state` holds only the current answer: unlike a step,
-- there is no per-person version of "this video is published".

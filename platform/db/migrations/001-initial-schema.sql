-- =============================================================================
-- 001 — Initial schema
--
-- Works on MySQL 8.0+ and MariaDB 11+. Nothing here is exclusive to either.
--
-- Conventions, decided in openspec/changes/plataforma-cliente/design.md:
--   · Every DATETIME is UTC. The server runs with time_zone='+00:00'.
--     Rendering in America/Sao_Paulo is the application's job.
--   · Internal ids are BIGINT UNSIGNED. Anything that appears in a URL also
--     carries `public_code` CHAR(26) (ULID), so row counts stay private.
--   · Every domain table carries `client_id`. No query runs without it.
--   · No hard deletes in work tables — `archived_at` marks the exit.
--   · Ratios are stored as ratios (0.002300), never as pre-formatted percentages.
--   · Comments and identifiers are English; user-facing text is pt-BR.
--
-- Reserved words were checked against a live MySQL 8.4 on 2026-08-05: `user`,
-- `session`, `file`, `client`, `step`, `delivery`, `request`, `position`,
-- `tier`, `kind`, `state`, `source` and `target` all work as identifiers.
-- `rank` and `groups` do NOT — which is why `position` and `tier` are used
-- where "order" and "group" would read more naturally.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- =============================================================================
-- 1. IDENTITY AND SCOPE
-- =============================================================================

-- An account we work for. The platform ships with a single row here, but no
-- query assumes that.
CREATE TABLE client (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code       CHAR(26)        NOT NULL,
  slug              VARCHAR(60)     NOT NULL COMMENT 'used in the URL: bianca-olivo',
  name              VARCHAR(120)    NOT NULL,
  brand             VARCHAR(120)        NULL COMMENT 'My Favorite',
  instagram_handle  VARCHAR(60)         NULL COMMENT 'no @',
  website           VARCHAR(255)        NULL,
  niche             VARCHAR(40)     NOT NULL DEFAULT 'lifestyle'
                    COMMENT 'matches the key in src/dominio/benchmarks.ts',
  timezone          VARCHAR(40)     NOT NULL DEFAULT 'America/Sao_Paulo',
  archived_at       DATETIME            NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_slug (slug),
  UNIQUE KEY uq_client_code (public_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Who signs in.
--
-- `client_id` NULL = consultant: sees every client.
-- `client_id` set  = that client's user: sees only their own.
-- That is the entire access rule, in one column. No permission matrix.
CREATE TABLE user (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code    CHAR(26)        NOT NULL,
  client_id      BIGINT UNSIGNED     NULL,
  email          VARCHAR(190)    NOT NULL,
  password_hash  VARCHAR(255)        NULL COMMENT 'argon2id; NULL until the invite is accepted',
  name           VARCHAR(120)    NOT NULL,
  role           ENUM('consultant','client') NOT NULL,
  active         TINYINT(1)      NOT NULL DEFAULT 1,
  last_seen_at   DATETIME            NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_email (email),
  UNIQUE KEY uq_user_code  (public_code),
  KEY ix_user_client (client_id),
  CONSTRAINT fk_user_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 90-day session with sliding renewal: she signs in once on her phone and stays
-- signed in. `id` is the SHA-256 of the cookie token — a database leak does not
-- hand anyone a usable session.
CREATE TABLE session (
  id          CHAR(64)        NOT NULL COMMENT 'sha256 hex of the cookie token',
  user_id     BIGINT UNSIGNED NOT NULL,
  expires_at  DATETIME        NOT NULL,
  ip          VARCHAR(45)         NULL COMMENT 'text: IPv6 fits in 45. Readable in a query, which is the point of storing it',
  user_agent  VARCHAR(255)        NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_session_user    (user_id),
  KEY ix_session_expires (expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id)
    REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Single-use invite (7 days) and password reset (1 hour).
--
-- Same table because the mechanism is identical: a single-use token with an
-- expiry. `purpose` tells them apart. Only the hash is stored.
CREATE TABLE credential_token (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64)        NOT NULL COMMENT 'sha256 hex; the raw token only ever exists in the emailed link',
  purpose     ENUM('invite','reset') NOT NULL,
  expires_at  DATETIME        NOT NULL,
  used_at     DATETIME            NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_credential_hash (token_hash),
  KEY ix_credential_user (user_id, purpose),
  CONSTRAINT fk_credential_user FOREIGN KEY (user_id)
    REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 2. WORK — what was delivered and what was asked for
-- =============================================================================

-- A working cycle with a goal and a north-star metric. Mirrors perfil/metas.md.
CREATE TABLE cycle (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code        CHAR(26)        NOT NULL,
  client_id          BIGINT UNSIGNED NOT NULL,
  title              VARCHAR(160)    NOT NULL COMMENT 'pt-BR, e.g. "Caminho ate a compra"',
  goal               TEXT                NULL COMMENT 'pt-BR, in the client language, not in metrics',
  north_star_metric  VARCHAR(160)        NULL,
  starts_on          DATE            NOT NULL,
  ends_on            DATE                NULL,
  state              ENUM('draft','active','closed') NOT NULL DEFAULT 'draft',
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cycle_code (public_code),
  KEY ix_cycle_client (client_id, state),
  CONSTRAINT fk_cycle_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- A document handed to the client. Replaces one page published on Vercel.
CREATE TABLE delivery (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code      CHAR(26)        NOT NULL,
  client_id        BIGINT UNSIGNED NOT NULL,
  cycle_id         BIGINT UNSIGNED     NULL,
  slug             VARCHAR(80)     NOT NULL COMMENT 'cinco-ajustes',
  title            VARCHAR(200)    NOT NULL COMMENT 'pt-BR: the client reads this',
  subtitle         TEXT                NULL COMMENT 'pt-BR',
  kind             ENUM('plan','analysis','report','audit') NOT NULL,
  period_start     DATE                NULL COMMENT 'data window the delivery analyses',
  period_end       DATE                NULL,
  reading_minutes  SMALLINT UNSIGNED   NULL,
  position         SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  published_at     DATETIME            NULL COMMENT 'NULL = draft, invisible to the client',
  archived_at      DATETIME            NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_code        (public_code),
  UNIQUE KEY uq_delivery_client_slug (client_id, slug),
  KEY ix_delivery_cycle (cycle_id),
  CONSTRAINT fk_delivery_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT,
  CONSTRAINT fk_delivery_cycle FOREIGN KEY (cycle_id)
    REFERENCES cycle (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- One action the client carries out. The five adjustments are five rows.
--
-- `evidence_value` + `evidence_label` carry the number that backs the advice.
-- The project rule is that no recommendation reaches the client without the
-- observed number that motivated it; these columns exist so the screen cannot
-- forget it.
CREATE TABLE step (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  delivery_id     BIGINT UNSIGNED NOT NULL,
  client_id       BIGINT UNSIGNED NOT NULL COMMENT 'denormalised: avoids a join just to check scope',
  code            VARCHAR(12)     NOT NULL COMMENT 'a1..a5, stable across delivery revisions',
  title           VARCHAR(200)    NOT NULL COMMENT 'pt-BR',
  summary         TEXT                NULL COMMENT 'pt-BR',
  deadline_label  VARCHAR(40)         NULL COMMENT 'pt-BR: "hoje, se der" / "esta semana"',
  urgency         ENUM('today','this_week','ongoing') NOT NULL DEFAULT 'this_week',
  evidence_value  VARCHAR(60)         NULL COMMENT '0,66% / 347.482',
  evidence_label  VARCHAR(160)        NULL COMMENT 'pt-BR: "de conversao no dia"',
  position        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_step_delivery_code (delivery_id, code),
  KEY ix_step_client (client_id),
  CONSTRAINT fk_step_delivery FOREIGN KEY (delivery_id)
    REFERENCES delivery (id) ON DELETE CASCADE,
  CONSTRAINT fk_step_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- What the client answered about each step. Kept apart from `step` because the
-- step is what the consultant wrote and the state is what she replied.
--
-- Three states, not two. `blocked` is what the old HTML checkbox threw away —
-- and what blocked her is as useful as what worked.
CREATE TABLE step_status (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  step_id       BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  state         ENUM('pending','done','blocked') NOT NULL DEFAULT 'pending',
  comment       TEXT                NULL COMMENT 'pt-BR: what blocked her, or what she noticed doing it',
  completed_at  DATETIME            NULL,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_step_status (step_id, user_id),
  KEY ix_step_status_user (user_id),
  CONSTRAINT fk_step_status_step FOREIGN KEY (step_id)
    REFERENCES step (id) ON DELETE CASCADE,
  CONSTRAINT fk_step_status_user FOREIGN KEY (user_id)
    REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Intake: something asked for, with an owner, a due date and a state.
--
-- The five asks that close the 203-Reels analysis land here as five rows.
-- `kind='data'` dominates: four of the five are just "send me the data".
CREATE TABLE request (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code     CHAR(26)        NOT NULL,
  client_id       BIGINT UNSIGNED NOT NULL,
  delivery_id     BIGINT UNSIGNED     NULL COMMENT 'the delivery that raised the ask',
  cycle_id        BIGINT UNSIGNED     NULL,
  title           VARCHAR(200)    NOT NULL COMMENT 'pt-BR',
  description     TEXT                NULL COMMENT 'pt-BR: step by step of where to find the data',
  why_it_matters  TEXT                NULL COMMENT 'pt-BR; without this the ask is a chore with no reason',
  kind            ENUM('data','action','question','material') NOT NULL DEFAULT 'data',
  raised_by_side  ENUM('consultant','client') NOT NULL DEFAULT 'consultant',
  priority        ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  state           ENUM('open','in_progress','delivered','dropped') NOT NULL DEFAULT 'open'
                  COMMENT 'projection of the latest request_event; kept here so listing needs no aggregate',
  due_on          DATE                NULL,
  opened_by       BIGINT UNSIGNED     NULL,
  closed_at       DATETIME            NULL,
  position        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_request_code (public_code),
  KEY ix_request_client_state (client_id, state, due_on),
  KEY ix_request_delivery (delivery_id),
  CONSTRAINT fk_request_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT,
  CONSTRAINT fk_request_delivery FOREIGN KEY (delivery_id)
    REFERENCES delivery (id) ON DELETE SET NULL,
  CONSTRAINT fk_request_cycle FOREIGN KEY (cycle_id)
    REFERENCES cycle (id) ON DELETE SET NULL,
  CONSTRAINT fk_request_author FOREIGN KEY (opened_by)
    REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Request log: comment, state change and attachment, each with author and time.
-- Answers "when did I ask for this and when did she see it" without relying on
-- anyone's memory of a conversation.
CREATE TABLE request_event (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id  BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED     NULL,
  kind        ENUM('comment','state_change','file','view') NOT NULL,
  body        TEXT                NULL COMMENT 'pt-BR',
  from_state  VARCHAR(20)         NULL,
  to_state    VARCHAR(20)         NULL,
  file_id     BIGINT UNSIGNED     NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_event_request (request_id, created_at),
  CONSTRAINT fk_event_request FOREIGN KEY (request_id)
    REFERENCES request (id) ON DELETE CASCADE,
  CONSTRAINT fk_event_user FOREIGN KEY (user_id)
    REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- An uploaded file. The bytes live on the VPS disk; the identity lives here.
--
-- The name the browser sent never touches the filesystem: `path` is generated
-- by the server. `sha256` catches a re-upload of the same file and proves
-- integrity. Nothing is served statically — download goes through a route that
-- checks the session and the client scope.
CREATE TABLE file (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code    CHAR(26)        NOT NULL,
  client_id      BIGINT UNSIGNED NOT NULL,
  request_id     BIGINT UNSIGNED     NULL,
  original_name  VARCHAR(255)    NOT NULL,
  path           VARCHAR(400)    NOT NULL COMMENT 'relative to the storage root',
  mime           VARCHAR(100)    NOT NULL,
  bytes          BIGINT UNSIGNED NOT NULL,
  sha256         CHAR(64)        NOT NULL,
  uploaded_by    BIGINT UNSIGNED     NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_file_code (public_code),
  KEY ix_file_client  (client_id, created_at),
  KEY ix_file_request (request_id),
  KEY ix_file_sha     (client_id, sha256),
  CONSTRAINT fk_file_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT,
  CONSTRAINT fk_file_request FOREIGN KEY (request_id)
    REFERENCES request (id) ON DELETE SET NULL,
  CONSTRAINT fk_file_user FOREIGN KEY (uploaded_by)
    REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE request_event
  ADD CONSTRAINT fk_event_file FOREIGN KEY (file_id)
    REFERENCES file (id) ON DELETE SET NULL;


-- =============================================================================
-- 3. NUMBERS — series, target and reference
-- =============================================================================

-- Metric catalogue. Says what the `value` column means and how to render it.
CREATE TABLE metric_def (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  metric_key      VARCHAR(60)     NOT NULL COMMENT 'saves_reach, tracked_sessions',
  label           VARCHAR(120)    NOT NULL COMMENT 'pt-BR: as the client sees it',
  short_label     VARCHAR(40)         NULL COMMENT 'pt-BR',
  unit            ENUM('ratio','count','currency','seconds') NOT NULL,
  direction       ENUM('up','down') NOT NULL DEFAULT 'up'
                  COMMENT 'so the screen knows whether a drop is good or bad',
  decimals        TINYINT UNSIGNED NOT NULL DEFAULT 2,
  description     TEXT                NULL COMMENT 'pt-BR, in business language: why this matters',
  how_to_measure  VARCHAR(255)        NULL COMMENT 'pt-BR: "Insights > Atividade do perfil"',
  tier            ENUM('north_star','decision','monitor') NOT NULL DEFAULT 'monitor'
                  COMMENT 'monitor = report it, do not optimise it',
  PRIMARY KEY (id),
  UNIQUE KEY uq_metric_key (metric_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- The series. One value per period PER SOURCE.
--
-- The same metric can arrive from Insights and from GA4 with different numbers,
-- and overwriting one with the other would destroy the very disagreement that
-- needs to surface — that was July's revenue: the store dashboard said
-- R$ 10,583.28 and the form said R$ 12.7k. Both rows exist; `source` says which
-- is which.
--
-- DECIMAL(16,6) holds 10583.280000 and the ratio 0.002300 in the same column.
-- Floating point in a money column is a bug with a date on it.
CREATE TABLE metric_value (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id      BIGINT UNSIGNED NOT NULL,
  metric_def_id  BIGINT UNSIGNED NOT NULL,
  period         DATE            NOT NULL COMMENT 'first day of the measured window',
  granularity    ENUM('day','week','month') NOT NULL DEFAULT 'month',
  value          DECIMAL(16,6)   NOT NULL,
  sample_size    INT UNSIGNED        NULL COMMENT 'how many posts back this number',
  source         ENUM('insights','ga4','store','public','manual') NOT NULL,
  note           VARCHAR(255)        NULL COMMENT 'pt-BR: sample below minimum, contested value, etc.',
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_metric_value (client_id, metric_def_id, period, granularity, source),
  KEY ix_metric_value_series (client_id, metric_def_id, period),
  CONSTRAINT fk_value_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT,
  CONSTRAINT fk_value_def FOREIGN KEY (metric_def_id)
    REFERENCES metric_def (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Baseline and target per cycle.
--
-- `contaminated` exists because perfil/metas.md already carries two such rows:
-- the 7,976 sessions and July's revenue were generated with no link in the bio.
-- A screen that shows a contaminated baseline as if it were clean produces a
-- fictional target. The project rule is "baseline before target"; this column
-- is that rule written in SQL.
CREATE TABLE metric_target (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id      BIGINT UNSIGNED NOT NULL,
  cycle_id       BIGINT UNSIGNED NOT NULL,
  metric_def_id  BIGINT UNSIGNED NOT NULL,
  baseline       DECIMAL(16,6)       NULL,
  baseline_on    DATE                NULL,
  target         DECIMAL(16,6)       NULL COMMENT 'NULL while the baseline is not trustworthy',
  contaminated   TINYINT(1)      NOT NULL DEFAULT 0,
  note           TEXT                NULL COMMENT 'pt-BR: why it is contaminated, or how the target was set',
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_target (cycle_id, metric_def_id),
  KEY ix_target_client (client_id),
  CONSTRAINT fk_target_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT,
  CONSTRAINT fk_target_cycle FOREIGN KEY (cycle_id)
    REFERENCES cycle (id) ON DELETE CASCADE,
  CONSTRAINT fk_target_def FOREIGN KEY (metric_def_id)
    REFERENCES metric_def (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Niche reference, seeded from src/dominio/benchmarks.ts. The engine stays the
-- origin of the number; this is a queryable copy.
-- `source` and `updated_on` are required: a benchmark with no provenance is a
-- rumour.
CREATE TABLE benchmark (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  niche          VARCHAR(40)     NOT NULL,
  metric_def_id  BIGINT UNSIGNED NOT NULL,
  value          DECIMAL(16,6)   NOT NULL,
  source         VARCHAR(200)    NOT NULL,
  updated_on     DATE            NOT NULL COMMENT 'over 12 months old, the screen flags it',
  PRIMARY KEY (id),
  UNIQUE KEY uq_benchmark (niche, metric_def_id),
  CONSTRAINT fk_benchmark_def FOREIGN KEY (metric_def_id)
    REFERENCES metric_def (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- An experiment with a hypothesis, an isolated variable and a success rule.
-- `position` exists because the cycle has a mandatory order: UTM first, alone.
CREATE TABLE experiment (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code        CHAR(26)        NOT NULL,
  client_id          BIGINT UNSIGNED NOT NULL,
  cycle_id           BIGINT UNSIGNED NOT NULL,
  name               VARCHAR(160)    NOT NULL COMMENT 'pt-BR',
  hypothesis         TEXT            NOT NULL COMMENT 'pt-BR',
  isolated_variable  VARCHAR(160)        NULL COMMENT 'pt-BR',
  metric_def_id      BIGINT UNSIGNED     NULL,
  success_value      DECIMAL(16,6)       NULL,
  success_label      VARCHAR(200)        NULL COMMENT 'saves/reach >= 0,8%',
  min_sample         SMALLINT UNSIGNED   NULL COMMENT '7 posts',
  min_days           SMALLINT UNSIGNED   NULL COMMENT '14 days',
  position           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  starts_on          DATE                NULL,
  ends_on            DATE                NULL,
  state              ENUM('not_started','running','read','inconclusive','abandoned')
                     NOT NULL DEFAULT 'not_started',
  outcome            TEXT                NULL COMMENT 'pt-BR: what happened to the metric, including failure',
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_experiment_code (public_code),
  KEY ix_experiment_cycle (cycle_id, position),
  CONSTRAINT fk_experiment_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT,
  CONSTRAINT fk_experiment_cycle FOREIGN KEY (cycle_id)
    REFERENCES cycle (id) ON DELETE CASCADE,
  CONSTRAINT fk_experiment_def FOREIGN KEY (metric_def_id)
    REFERENCES metric_def (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 4. ARCHIVE — the posts
-- =============================================================================

-- One post. The 203 Reels from Jan to Aug 2026 land here via the CSV importer.
--
-- Public-source and Insights-source columns are kept apart and NULL by default.
-- The public CSV brings `views`, `likes`, `comments`. It does NOT bring `reach`
-- or `retention_pct` — only Insights has those. A NULL `reach` is the truth;
-- filling it with `views` would fabricate a denominator, and every rate in this
-- domain is normalised by reach.
CREATE TABLE post (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id       BIGINT UNSIGNED NOT NULL,
  ig_code         VARCHAR(40)     NOT NULL COMMENT 'Instagram shortcode',
  kind            ENUM('reel','carousel','image','story') NOT NULL,
  published_at    DATETIME        NOT NULL,
  url             VARCHAR(255)        NULL,
  caption         TEXT                NULL,
  duration_sec    SMALLINT UNSIGNED   NULL,
  pillar          VARCHAR(40)         NULL COMMENT 'Espelho, Provador, Padrao, Bastidor',
  mentions_brand  TINYINT(1)          NULL,
  names_product   TINYINT(1)          NULL,
  has_cta         TINYINT(1)          NULL COMMENT 'a purchase call is present',
  boosted         TINYINT(1)          NULL COMMENT 'NULL = not asked yet',

  -- public data (open API)
  views           BIGINT UNSIGNED     NULL,
  likes           BIGINT UNSIGNED     NULL,
  comments        BIGINT UNSIGNED     NULL,
  reposts         BIGINT UNSIGNED     NULL COMMENT 'media_repost_count: this is a repost, NOT a DM send',

  -- Insights data (only exists with an account export)
  reach           BIGINT UNSIGNED     NULL,
  saves           BIGINT UNSIGNED     NULL,
  sends           BIGINT UNSIGNED     NULL COMMENT 'DM sends — this one is the real thing',
  retention_pct   DECIMAL(6,3)        NULL,
  avg_watch_sec   DECIMAL(8,2)        NULL,

  provenance      ENUM('public','insights','mixed') NOT NULL DEFAULT 'public',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_post (client_id, ig_code),
  KEY ix_post_date   (client_id, published_at),
  KEY ix_post_pillar (client_id, pillar, duration_sec),
  CONSTRAINT fk_post_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 5. AUDIT
-- =============================================================================

-- Who did what. Client documents carry revenue, conversion and audience data;
-- knowing who read them and who changed them is not a luxury.
CREATE TABLE audit_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED     NULL,
  client_id   BIGINT UNSIGNED     NULL,
  action      VARCHAR(60)     NOT NULL COMMENT 'signed_in, downloaded_file, changed_step',
  entity      VARCHAR(40)         NULL,
  entity_id   BIGINT UNSIGNED     NULL,
  details     JSON                NULL,
  ip          VARCHAR(45)         NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_client (client_id, created_at),
  KEY ix_audit_user   (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The `migration` bookkeeping table is created by the migrator itself
-- (`db/migrate.ts`) before it applies any file. If it were born here, 001 would
-- have to record itself in a table it is still creating.

-- =============================================================================
-- 003 — The editorial pillars, and the thing a step asks her to paste
--
-- TWO PROBLEMS, ONE MIGRATION, BECAUSE THEY ARE THE SAME PROBLEM
--
-- The plan reached her as five chores. The reasoning that produced them — which
-- pillar each one serves, what share of the week it should take, which metric it
-- moves, and what result would settle it — lived in a markdown file she has
-- never seen. A list of chores with the argument stripped out is a list she can
-- only obey or ignore; she cannot disagree with it, and disagreeing is the part
-- that makes a plan hers.
--
-- The same shape, smaller: step `a1` says "swap the bio link for a tagged one"
-- and explains why it matters, and then does not give her the link. She pasted
-- something — the wrong thing. Measured on 06/08/2026 the bio now carries
-- `utm_source`/`utm_medium` with no trace of her name in either, which credits
-- the traffic to "Instagram, bio" and not to her: the store's own account has a
-- bio link too and lands in the same place. A step that names a value and does
-- not hand it over is a step that invites a near miss.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- What a step wants her to copy, verbatim.
--
-- Two columns and not one: the value is the payload and the label is what makes
-- it safe to paste. "Cole isto no link da bio" and "Cole isto na descrição do
-- Story" are the same string in different places, and pasting the right value
-- into the wrong field is the failure this is here to prevent.
ALTER TABLE step
  ADD COLUMN copy_value  TEXT         NULL
    COMMENT 'exact string she should paste — a URL with UTM, a caption, a handle'
    AFTER evidence_label,
  ADD COLUMN copy_label  VARCHAR(120) NULL
    COMMENT 'pt-BR: where it goes — "Cole isto no link da sua bio"'
    AFTER copy_value;


-- The editorial pillars: the mix, and the argument for it.
--
-- Scoped to a CYCLE and not to the client, because a pillar is a bet with an
-- expiry date. When the cycle closes, its pillars close with it and the next
-- cycle's mix is a new row — which is what makes it possible to ask later
-- whether the bet paid off, instead of quietly editing history.
--
-- `share_pct` is deliberately not constrained to sum to 100. A mix that adds to
-- 95 while someone is still deciding is a draft, not corruption, and a CHECK
-- would make the seed fail halfway through with the table half written.
CREATE TABLE pillar (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id       BIGINT UNSIGNED NOT NULL,
  cycle_id        BIGINT UNSIGNED NOT NULL,
  pillar_key      VARCHAR(40)     NOT NULL COMMENT 'espelho / provador / padrao / bastidor',
  name            VARCHAR(80)     NOT NULL COMMENT 'pt-BR',
  share_pct       TINYINT UNSIGNED    NULL COMMENT 'share of the week, 0-100',
  per_week        VARCHAR(40)         NULL COMMENT 'pt-BR: "4 por semana", "1 a cada 2 semanas"',
  thesis          TEXT                NULL COMMENT 'pt-BR: what this pillar is',
  role_note       TEXT                NULL COMMENT 'pt-BR: why it exists in the mix',
  evidence        TEXT                NULL COMMENT 'pt-BR: the post and the number that justify it',
  -- The metric this pillar is supposed to move, by `metric_def.metric_key`
  -- rather than by id: the seed writes pillars and metric definitions in the
  -- same run, and a foreign key would force an ordering between two things that
  -- have no real dependency. The screen resolves the key when it needs a label.
  metric_key      VARCHAR(60)         NULL,
  success_label   VARCHAR(200)        NULL COMMENT 'pt-BR: what would settle it',
  -- A control pillar is the one that must NOT change: it is how you tell a
  -- reallocation that worked from one that went too far. Without the flag, the
  -- screen would present it as a target like the others and invite her to push
  -- on the one thing that is already carrying the account.
  is_control      TINYINT(1)      NOT NULL DEFAULT 0,
  position        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pillar_cycle_key (cycle_id, pillar_key),
  KEY ix_pillar_client (client_id),
  CONSTRAINT fk_pillar_client FOREIGN KEY (client_id)
    REFERENCES client (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pillar_cycle FOREIGN KEY (cycle_id)
    REFERENCES cycle (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- What the mix costs, in her words, on the cycle it belongs to.
--
-- The reallocation lowers average views on purpose — the humour reels that do
-- two million are being partly traded for content that converts. Everyone
-- involved has to have agreed to that BEFORE it starts, because three weeks in
-- the only visible effect is the fall. Left unsaid, she checks reach, concludes
-- she broke something, and reverts the week before the reading window closes.
--
-- On `cycle` and not in a screen's markup: it is a term of this cycle's deal,
-- and the next cycle's trade-off will be a different sentence or none at all.
ALTER TABLE cycle
  ADD COLUMN trade_off TEXT NULL
    COMMENT 'pt-BR: what this cycle knowingly gives up, agreed up front'
    AFTER goal;

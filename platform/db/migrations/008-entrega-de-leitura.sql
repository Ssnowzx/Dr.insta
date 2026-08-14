-- =============================================================================
-- 008 — A delivery that is read instead of done
--
-- WHY
--
-- On 13 August 2026 Bianca sent two exports covering 376 posts. Reading them
-- produced the strongest finding this project has had about her profile: her
-- long, opinionated content turns strangers into followers at forty-one times
-- the rate of the brand series, and almost never reaches a stranger at all.
--
-- She has no screen where that is written. It lives in the consultant's notes
-- and in one line of a request outcome.
--
-- The cause was structural rather than forgetfulness. `delivery.kind` has
-- offered 'analysis' since 001, but `deliveries()` joins `step` with an INNER
-- JOIN, so a delivery with no steps does not exist for the product — not on a
-- screen, not in a count, not in a summary. An analysis is reading, not chores,
-- and had nowhere to put a paragraph regardless: `delivery` carries a title and
-- a subtitle, `step` carries a checkbox, and no table held prose.
--
-- WHY A TABLE AND NOT A MARKDOWN COLUMN
--
-- Rendering Markdown means a dependency or a hand-written parser, in a product
-- with seven runtime dependencies. A block with its own numeric highlight does
-- not exist in Markdown without inventing syntax. And as rows, order and
-- emphasis are data the seed writes and the database validates, rather than a
-- blob nobody checks.
--
-- WHY `highlight` IS TEXT
--
-- The highlight is "41×", "0,025%", "3.131" — already formatted, in the unit
-- the sentence uses. A DECIMAL would force the screen to re-decide formatting
-- that the person writing the sentence had already decided, and "41×" is not a
-- number in any unit this schema knows.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


CREATE TABLE delivery_section (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  delivery_id      BIGINT UNSIGNED NOT NULL,

  -- Reading order. Not the primary key: blocks get reordered, and an id that
  -- carries meaning is an id that cannot be reordered.
  position         SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  -- Optional: a block with no title continues the one above it rather than
  -- opening with an empty heading.
  title            VARCHAR(200) NULL,

  body             TEXT NOT NULL,

  -- The number that carries the paragraph, and what it means. Separate from the
  -- body so its weight does not depend on someone remembering to repeat it.
  highlight        VARCHAR(40) NULL,
  highlight_label  VARCHAR(160) NULL,

  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_section_position (delivery_id, position),
  KEY ix_section_delivery (delivery_id, position),

  -- Same cascade as `step`: the sections of a deleted delivery are not
  -- something anyone would want left behind pointing at nothing.
  CONSTRAINT fk_section_delivery FOREIGN KEY (delivery_id)
    REFERENCES delivery (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

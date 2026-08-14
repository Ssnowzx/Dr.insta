-- =============================================================================
-- 007 — The request gets a baton, and the baton is visible
--
-- WHY
--
-- On 13 August 2026 Bianca answered nine requests and uploaded sixteen files in
-- one afternoon. Her screen then said "em andamento" — and would go on saying
-- it until someone marked the request delivered. She had no way to tell whether
-- the material had arrived, whether it was useful, or whether anyone had opened
-- it.
--
-- The cause was one column answering two questions from two people: "did I do
-- my part" and "what happened to what I sent". Only the first was ever
-- answered. Worse, `in_progress` fired automatically on her first upload, so
-- the one label that could have promised attention was indistinguishable from
-- nobody looking.
--
-- WHAT CHANGES
--
--   open        -> waiting on whoever must deliver
--   answered    -> the material arrived; the turn passes to whoever asked
--   analyzing   -> it is being read (set by hand, never by a trigger)
--   concluded   -> there is a written outcome
--   dropped     -> it will not happen
--
-- `in_progress` becomes `answered` and `delivered` becomes `concluded`. The
-- rename is not cosmetic: `delivered` meant both "she handed the material over"
-- and "he closed the request", and `concluded` now carries a rule the old name
-- never did — it cannot be reached without `outcome`.
--
-- THE TRAP THIS FILE HAS TO AVOID
--
-- `request_event.from_state` and `to_state` are plain VARCHAR, not the enum.
-- They do not follow an ALTER, so renaming only the enum leaves every historic
-- event still saying `delivered` while the row says `concluded` — a history
-- that disagrees with the thing it is the history of. They are updated here.
--
-- The enum is widened before the rows move and narrowed afterwards. Going
-- straight to the final set would leave existing `in_progress` / `delivered`
-- rows holding values the column no longer accepts.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- 1. Widen: old and new values coexist for the length of this migration.
ALTER TABLE request
  MODIFY COLUMN state
    ENUM('open','in_progress','delivered','dropped','answered','analyzing','concluded')
    NOT NULL DEFAULT 'open';


-- 2. Move the rows.
UPDATE request SET state = 'answered'  WHERE state = 'in_progress';
UPDATE request SET state = 'concluded' WHERE state = 'delivered';


-- 3. Narrow to the final set, in the order the baton travels.
ALTER TABLE request
  MODIFY COLUMN state
    ENUM('open','answered','analyzing','concluded','dropped')
    NOT NULL DEFAULT 'open';


-- 4. The history. VARCHAR columns, invisible to the ALTER above.
UPDATE request_event SET from_state = 'answered'  WHERE from_state = 'in_progress';
UPDATE request_event SET to_state   = 'answered'  WHERE to_state   = 'in_progress';
UPDATE request_event SET from_state = 'concluded' WHERE from_state = 'delivered';
UPDATE request_event SET to_state   = 'concluded' WHERE to_state   = 'delivered';


-- 5. The outcome.
--
-- Nullable on purpose, even though concluding without it is forbidden. NOT NULL
-- would reject every row that already exists, and `dropped` is allowed to carry
-- no explanation. The rule lives in `lib/pedido-store.ts`, which the screen and
-- the CLI both call — `request-actions.ts` is `'use server'` and the terminal
-- cannot reach it, which is exactly why the rule is not there.
ALTER TABLE request
  ADD COLUMN outcome TEXT NULL AFTER state;


-- Rows that were already closed get an outcome saying why they have none.
--
-- Everything that was `delivered` becomes `concluded`, and the product now
-- states that `concluded` is unreachable without an explanation — the rule is
-- enforced in `lib/pedido-store.ts` for both the screen and the CLI. Migrating
-- in silence would leave the client looking at requests marked "concluído" with
-- nothing written under them, which is precisely the silence this whole change
-- exists to remove, wearing the new label.
--
-- The sentence is deliberately about the product and not about her request: it
-- is true, it is short, and it does not invent a finding nobody wrote.
UPDATE request
  SET outcome = 'Este pedido foi fechado antes de existir o campo de resposta. Se você quiser saber o que saiu dele, me pergunta por aqui que eu escrevo.'
  WHERE state = 'concluded' AND outcome IS NULL;

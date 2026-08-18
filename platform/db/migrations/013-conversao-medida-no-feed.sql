-- =============================================================================
-- 013 — Follower conversion, measured instead of typed, where the API allows it
--
-- WHAT WAS MEASURED, 18/08/2026
--
-- `GET /{media-id}/insights` was probed one metric at a time against a Reel and
-- against a carousel on the same account (`scripts/probe-media-metrics.ts`).
-- The result is a pair, metric x surface, and neither half alone:
--
--   FEED   follows, profile_visits, profile_activity  -> answered
--          ig_reels_avg_watch_time, ..._total_time    -> 400
--   REELS  the reverse, exactly
--
-- `reach` and `views` answered on both and were the controls: without them a
-- 400 would not distinguish "this metric does not exist" from "this call was
-- bad".
--
-- WHY IT MATTERS HERE
--
-- The cycle in force is decided by follower conversion, and until today every
-- figure of it was either inferred from traffic source or typed in by hand.
-- `post.non_follower_pct` exists solely because nothing measured it. On feed
-- posts, two of the three steps of the funnel are now readable by machine:
-- reach -> profile visit -> follow.
--
-- The Reel keeps depending on a number she types, and that is the surface the
-- cycle actually runs on. This is not the end of manual collection; it is the
-- end of it for one third of what she publishes.
--
-- WHY TWO COLUMNS AND NOT A RATE
--
-- Every rate in this project is computed at the point of use, over a declared
-- denominator. A stored `follows_per_reach` would freeze a division whose
-- honest denominator — non-follower reach — is not the one available, and the
-- screens would read a rate nobody could audit back to its parts.
--
-- NULL means not measured, and that is different from zero. A post whose
-- surface refuses the metric, or that was collected before this migration,
-- carries NULL and every reader must keep treating it as absent — the same
-- rule `reach` already follows for public-sourced rows.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'post'
               AND COLUMN_NAME = 'follows');
SET @sql := IF(@tem = 0,
  'ALTER TABLE post ADD COLUMN follows BIGINT UNSIGNED NULL AFTER non_follower_pct',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'post'
               AND COLUMN_NAME = 'profile_visits');
SET @sql := IF(@tem = 0,
  'ALTER TABLE post ADD COLUMN profile_visits BIGINT UNSIGNED NULL AFTER follows',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

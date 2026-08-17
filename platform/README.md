# Platform

The consultancy's web application: deliveries with step tracking, request
intake, file uploads and a metric history.

Replaces the standalone HTML pages published on Vercel. The reasoning, the scope
and the discarded alternatives live in `openspec/changes/plataforma-cliente/`.

> **Language convention.** Code, comments, identifiers and database objects are
> English. Anything a person reads on screen — labels, error messages, delivery
> content — is Brazilian Portuguese.

> **One client per instance.** `TENANT_SLUG` names the client this deployment
> serves, and there is no client picker in the interface. A second client means
> a second instance with a different slug and its own database — not a second
> row on the same screen. See [Tenancy](#tenancy).

> **Whose brand is this.** The platform is the consultancy's; the brand it
> displays is the client's. Screens reachable without a session carry **no
> brand at all** — before anyone signs in there is no client to name. Inside,
> the brand comes from `client.brand` through `generateMetadata`, never from the
> source. A brand written into the code is a brand that lies on the second
> instance.

---

## Stack

| Layer | Choice |
|---|---|
| Application | Next.js 16 (App Router) · React 19 · TypeScript strict |
| Database | MySQL 8.4 (MariaDB 11 compatible) · Drizzle ORM |
| Auth | Session table · Argon2id · `HttpOnly; Secure; SameSite=Lax` cookie |
| Styling | CSS with the tokens already approved by the client, no framework |
| Charts | Server-rendered SVG, no library |
| Infra | Docker Compose (app + db) behind the host's Nginx |

Decisions and rejected alternatives: `openspec/changes/plataforma-cliente/design.md`.

---

## Running locally

Requires Docker and Node >= 20.19.

```bash
cd platform
cp .env.exemplo .env      # set DB_HOST=127.0.0.1 and DB_PORT=3307
npm install

# database only, port published on 127.0.0.1 (never in production)
docker compose -f docker-compose.yml -f compose.dev.yml up -d db

npm run db:migrate
npm run dev
```

`http://localhost:3000` should report how many tables exist in the schema.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (`standalone` output) |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Vitest (needs the database running) |
| `npm run db:migrate` | Applies pending migrations |
| `npm run db:status` | Lists what has been applied, changes nothing |
| `npm run db:seed` | Initial data |
| `npm run db:import-reels -- <csv>` | Imports the public Reels export |
| `npm run invite -- --email … --name …` | Creates a user on `TENANT_SLUG` and prints an invite link (`--consultant` for an unscoped one, `--job "assessora"` for what they do) |
| `npm run link -- --email …` | Prints a fresh access link for someone who already exists — invite or reset, chosen from the account |
| `npm run sync:instagram` | Collects the current month from the Instagram API (`--period YYYY-MM-01` to backfill) |

---

## Database

Migrations live in `db/migrations/`, applied in alphabetical order, once each.
Bookkeeping is the `migration` table, created by the migrator itself.

**DDL in MySQL commits implicitly** — there is no transactional `CREATE TABLE`
migration. If a file fails midway, part of it has been applied and the
bookkeeping row is *not* written. The migrator stops there rather than moving
on. A new migration always lands as a new file; never edit one already applied.

### The schema decisions worth knowing

1. **`user.client_id` NULL = consultant.** Set = that client's user. That is the
   whole access rule in one column, with no permission matrix.

   **A client can be more than one person.** Bianca runs the profile with an
   assistant, and both are `client` users on the same `client_id`. `job_title`
   says what each one does and is *descriptive only* — it never gates anything,
   or this column becomes the permission matrix the line above refuses.

   The one thing that is not shared is disconnecting the Instagram: the rule
   comes from `instagram_connection.connected_by`, a fact that already existed
   and that nothing read. See [The Instagram connection](#the-instagram-connection).
2. **`step_status` has three states: `pending`, `done`, `blocked`.** The old HTML
   checkbox threw `blocked` away — which is exactly what you need to know.

   Rows are still one per `(step, user)` — who said what is worth keeping — but
   the state a SCREEN shows is the team's, resolved in `lib/verificacao.ts`.
   Joining on the reader's own id was invisible with one client user and a
   defect on day one with two: Bianca marks it, Cris reads "a fazer", and the
   chore gets done twice or by neither.
3. **`UNIQUE (client_id, metric_def_id, period, granularity, source)`.** The same
   metric arrives from Insights and from GA4 with different numbers; overwriting
   one with the other would destroy the disagreement that needs to surface.
4. **`metric_target.contaminated`** marks a baseline that cannot set a target. It
   is the "baseline before target" rule written in SQL.
5. **`pillar` hangs off the CYCLE, not the client.** A pillar is a bet with an
   expiry date. Tied to the client, November's edit would overwrite August's mix
   and "did the bet pay off?" would lose its object. Tied to the cycle, closing
   the cycle freezes the mix. `is_control` marks the pillar that must NOT change
   — the one the reallocation is read against.
6. **`step.copy_value` is the string she pastes**, not a description of it. The
   step that named a tagged link without handing it over got a link with the
   wrong tag pasted into the bio, and nothing looked broken from her side.
   `copy_note` is a separate column from `summary` on purpose: the summary
   answers "why does this matter" and is read before the value appears.
7. **A step can prove itself.** `step.request_id` says "this chore IS that
   request"; `step.verify_key` names a fact the platform observes on its own.
   Both nullable, and a step with neither behaves exactly as it always did.
8. **`idea` carries the state, `idea_note` carries what they said about it.**
   Unlike a step there is no private version of "this video is out", so state
   lives on the row. The notes are a separate table for the reason
   `step_status` is one — see [Seeding](#seeding).

Full detail in the comments of `db/migrations/001-initial-schema.sql`,
`003-pillars-and-copy-value.sql` and `010-equipe-verificacao-e-pautas.sql`.

### What the plan stops asking for

The complaint that produced this: *"tem coisas que ela já fez e ainda está no
app, isso confunde"*. Three separate causes, all of them ours.

| Cause | Fix |
|---|---|
| The state was private to one reader | It is the team's, resolved once for both roles |
| The same job lived on two screens with nothing joining them | `step.request_id` — answering it in Pedidos closes it in Plano |
| The platform could see it happen and asked anyway | `step.verify_key` — today `instagram_connected` |

`lib/verificacao.ts` holds the rule, on its own and free of I/O, because every
one of its failure modes is silent: a step still asking after she did it looks
exactly like a step she has not done.

**Proof only ever moves a step TO `done`, never away from it.** If she connects,
marks it done and later disconnects, the step does not revert — a verifier is
evidence of completion, not of incompletion, and letting it revert would make
her plan flicker with the health of an API credential. A broken connection is
already announced on its own screen and in the digest.

**Proof does outrank `blocked`.** "Travei" plus "the platform watched it happen"
means the block is stale. The note she wrote stays on screen; the chore stops
being asked for.

### Pautas and scripts

`/ideias` is the schedule: what to film, on which day, with the hook written out
and the script in numbered blocks. `/conteudo` is its opposite end — what was
published, with the numbers.

**Three scripts a week, against the eight Reels she publishes.** That is the
finding and not a shortfall: across 376 posts the long opinion video converted
41× the brand pauta at comparable reach, while the 1–10s bucket — 39% of all her
reach — converts worst of anything she makes. The short, spontaneous half of her
week IS the distribution engine, and Espelho is the cycle's declared control.
Scripting it would break the one thing that is not broken.

`idea_beat` splits `says` from `shows` because they are instructions to two
different people: the assistant behind the camera is usually not the one
talking, and a merged paragraph makes each of them read past the half that is
theirs.

`idea_note` is what closes the loop. A batch of scripts that arrives and is
never argued with is a batch that gets ignored by week three, so what comes back
— "ficou longo", "essa abertura não é meu jeito de falar" — reaches `/novidades`
the day it is written, and the next batch is written from it.

### Seeding

`db/seed.ts` is idempotent, and every `onDuplicateKeyUpdate` **lists everything
the file authors**. This is not tidiness: the original upserts updated one
column each, so correcting a sentence in the file printed `Seeded` and left the
database as it was. The failure is silent and surfaces on the client's screen.

What stays out of the `set`: ids, `public_code`, and anything a person produced
in the app. `step_status` is hers and lives in its own table, so re-seeding
never touches an answer she gave.

Fixed in `cycle`, `step` and `pillar`. `request` still inserts only into an
empty table, and the remaining tables keep the old pattern — suspect them.

### Conventions

- Every `DATETIME` is **UTC** — server on `--default-time-zone=+00:00`, driver on
  `timezone: 'Z'`. Rendering in `America/Sao_Paulo` is the application's job.
- `DECIMAL` comes back as a **string** (`decimalNumbers: false`). Converting to
  `number` reintroduces floating point in the column that holds money.
- Ratios are stored as ratios (`0.002300`), never as pre-formatted percentages.
- No hard deletes in work tables: `archived_at` marks the exit.
- Every domain query filters by `client_id`.
- Reserved words checked against a live MySQL 8.4: `rank` and `groups` are not
  usable as identifiers, which is why `position` and `tier` appear where "order"
  and "group" would read more naturally.

---

## Colour, and the two ways it goes wrong

Every colour token lives in `app/base.css` as `light-dark(light, dark)`, and
`test/contrast.test.ts` measures the pairs against WCAG 2.2 AA — 4.5:1 for text,
3:1 for large text, control boundaries and meaningful graphics.

**The test measures PAIRS, so a pair it does not know about is a pair that can
fail.** That is not hypothetical: `--dado` is validated as a chart fill at 3:1
and was being used as `color` in six places, where the floor is 4.5. In light it
read between 2.95 and 3.85 — the worst being the "≤20s" tag, which marks the
exact format cut the cycle is testing. `--dado-texto` exists for those. The rule
the file already stated, now enforced: **adding a pair to the UI means adding it
here.**

**Everything passed in dark, because the work was done in dark.** Whichever
theme you build in, the defects concentrate in the other one. Check both, with
the toggle, before calling anything finished.

Two structural facts worth carrying:

- **In a dark interface, layers are made of light, not tone.** The plate against
  paper measures 14.78 in light and **1.18** in dark, and going darker does not
  help — near-black against dark paper is 1.07. At the bottom of the luminance
  curve there is no room left. Separation there comes from a lit edge, a glow or
  a shadow. `app/auth.css` is the worked example.
- **A field's boundary is a control boundary** and answers to 3:1, not to
  whatever looks tidy. `--linha` was doing that job at 1.53 and 1.47;
  `--linha-campo` is what fields use now.

---

## Tenancy

**One client per instance.** `TENANT_SLUG` names it, by `client.slug`. There is
no picker: both roles land on the same client, and the difference between them
is what they may *do*, not which client they see.

`lib/tenant.ts` resolves the slug to a `client_id` once per render pass;
`clientScope()` in `lib/dal.ts` is the only thing pages call:

```ts
const clientId = await clientScope()   // a client user's own id, or the tenant
```

It cannot return `null`, so no page has a "which client?" branch to get wrong.

Three properties worth keeping when this changes:

1. **The slug comes from the environment, never from the data.** Deriving it
   from "the only row in `client`" would let a forgotten seed row silently
   change who the instance serves, with a panel that renders perfectly.
2. **The slug comes from the environment, never from the request.** It used to
   arrive as `?cliente=`, which is why `clientScope()` consulted a client user's
   own `client_id` first. Nothing a request carries may widen a scope.
3. **`client_id` stays in the schema and in every query.** Single-tenancy is a
   property of the deployment, not a reason to drop the column that isolates one
   client's revenue figures from another's. `canReach` in `lib/scope.ts` is
   still the predicate, and still tested on its own.

A wrong or missing slug throws on the first request naming the variable and the
value — it does not fall back to a default and serve the wrong client.

---

## Keeping the data current

**Nothing here updates by itself, and every screen says so.** The metrics are
typed from Insights screenshots and the archive arrives by import, so a date
travels with the numbers — `lib/freshness.ts` decides the wording and the tone
escalates with the age. A warning that always looks urgent stops being read.

### What can be collected automatically, and what cannot

Three routes, and which one a number came in by is recorded on it as `source`.

| Route | What it gives |
|---|---|
| **Official API** (`api`) | reach, views, saves, shares, likes, comments, replies, follows, **bio link clicks**, and **the post itself** — caption, permalink, date, type |
| **Public export** (`public`) | views, likes, comments, caption, **duration**, date — per Reel |
| **By hand** (`insights`) | profile visits, video retention curve, Stories older than a day |

**The archive grows on its own now** — that changed on 17/08/2026. Until then the
`post` table was fed only by the public export, and the collector merely updated
rows it already found: she published between 9 and 17 August and the product
showed nothing, while every screen read fine and the routine reported success.
Worse, the hole sealed itself — the insight window is 30 days, so a post absent
when its window closes never gets reach from any route.

**Duration is the one thing only the export has.** No API field reports a Reel's
length, and none is derivable: `ig_reels_avg_watch_time` is how long people
watched, which is the numerator, not the denominator. A post born from the API
therefore has `duration_sec` NULL and belongs to neither side of the cycle's
`<=20s` cut — so `/conteudo` counts those separately and says so on the screen
rather than letting the chips quietly stop adding up. Importing an export later
FILLS the duration instead of duplicating the row: both routes key on the same
shortcode. The export is no longer required; it enriches.

The middle row cannot give reach, saves or shares — they do not exist in public
data. That was the whole constraint until the account was connected, and the
reason `saves/reach`, the cycle's decision metric, used to arrive by export or
not at all.

The bottom row is what the API still does not answer. `profile_visits` exists
per media but **not as an account metric**, so the funnel's second step is
manual. Retention comes back as an average (`ig_reels_avg_watch_time`), never
as the curve — the "how far they watched" screenshot request stands.

One trap worth naming: the public field `media_repost_count` is a **repost**
count, not a share count. Measured against July's screenshots it read 1,986
where Insights showed 48,000 shares. It is stored in its own column and never
treated as the strong signal.

### The Instagram connection

The client authorises her own account from **Conta**: Business Login for
Instagram, read-only (`instagram_business_basic`,
`instagram_business_manage_insights`). No Facebook Page, no password shared, and
she can disconnect from the same screen.

**Only the person who authorised it can disconnect it.** The role check was
enough while a client meant one person; with an assistant on the same account it
stops being. `connected_by` already recorded who did it, so the rule needs no new
column and no permission table. The button is not shown to anyone else — offering
it and refusing the click teaches her that the screen does not know what it is
showing. To hand it over, the other person connects the account herself and the
row moves with her: an authorisation is transferred by granting it again.

Set `IG_APP_ID`, `IG_APP_SECRET` and `ENCRYPTION_KEY` — see `.env.exemplo`. With
the first two blank the button is simply not offered and everything else works.

The token is stored encrypted (AES-256-GCM, key outside the database) and
refreshed with fifteen days to spare. **Losing `ENCRYPTION_KEY` loses the
connection**; she reconnects in two clicks.

#### Two traps this cost two days to find

**The authorisation URL must stay `/oauth/authorize/third_party/`.** On iOS,
`www.instagram.com` claims its own links, and the app's
`apple-app-site-association` excludes the flow as `/oauth/authorize/*` — with a
slash. The documented entry point is `/oauth/authorize` plus a query string,
which does **not** match that pattern, so the phone hands the navigation to the
Instagram app, where the consent screen does not exist: a stuck skeleton and
"Ocorreu um erro". A bare trailing slash does not help either — iOS does not
treat `*` as matching the empty string. `third_party` has a segment after the
slash, matches unambiguously, and is where the documented endpoint redirects on
its own. It is an internal path and Instagram may move it; if it ever 404s,
reverting to `/oauth/authorize` fixes every browser except iPhones.

**Per-post insights match the archive by shortcode, not by media id.** The API
answers with its own numeric id; `post.ig_code` holds the shortcode from the
permalink, because the archive is built from the public export, which never sees
that id. Comparing one against the other finds nothing and reports "0 post(s)
updated", which is indistinguishable from the API having no recent posts. The
insights call still uses the numeric id — it is the only identifier
`/{media}/insights` accepts.

#### What the API does not give

`profile_visits` has no account-level metric — it exists only per media — so the
second step of the funnel still arrives by monthly screenshot. The
follower / non-follower split of an audience is not exposed either, and that is
the honest denominator for follower conversion. Neither absence is a bug to fix
here; both are why some requests to the client remain open.

Collection runs from cron on the host, not from a timer inside the server —
which would die on every restart and keep no log anyone can read:

```cron
# /etc/cron.d/myfavorite-sync — host clock is UTC; the comments give São Paulo.
# 06,10,14,18,22 UTC = 03,07,11,15,19 in Brazil.
0 6,10,14,18,22 * * * root cd /home/drinsta/myfavorite/platform && docker compose exec -T app node_modules/.bin/tsx --conditions=react-server --env-file-if-exists=.env scripts/sync-instagram.ts >> /var/log/myfavorite-sync.log 2>&1

# 06:20 UTC on the 1st — close the month that just ended, in full.
20 6 1 * * root cd /home/drinsta/myfavorite/platform && docker compose exec -T app node_modules/.bin/tsx --conditions=react-server --env-file-if-exists=.env scripts/sync-instagram.ts --period $(date -u -d 'last month' +\%Y-\%m-01) >> /var/log/myfavorite-sync.log 2>&1
```

**Five runs a day, not one — and none of them between 00:00 and 05:00 UTC.**

The frequency is about the archive, not the metrics. The collector now creates
posts it does not find, so how often it runs decides how long something she
published is invisible. Once a day meant a Reel posted at her 18:00 peak
appeared the next morning; this catches it about an hour later.

The gap in the small hours is deliberate and is the trap named below: from 21:00
in Brazil the UTC date has already turned, so a run there on the last night of a
month collects the NEXT month while Brazil is still finishing the current one.
Skipping those hours means no run ever sees a month boundary the wrong way
round.

Frequency is cheap here and worth stating so nobody guesses: a run costs about
forty API calls — the account metrics plus one insights call per post inside the
30-day window — so five runs is roughly two hundred a day.

**What this does NOT make real-time, on purpose.** A post's numbers keep moving
for weeks, which is why the insight window is 30 days at all. Reach at hour one
is a figure that will be wrong at hour two, and this project's own rule is that
nothing is concluded under 7 posts or 14 days. Collecting often so the post
EXISTS is worth it; presenting its numbers as live would invite reading noise as
signal, which is how two cycles here already died without a reading.

Three decisions in those two lines.

**The order against the backup.** The dump runs at 07:00 UTC, after both. A
backup taken before the day's collection is a file that does not contain what
its name implies, and that only becomes visible while restoring it.

**The daily job never closes a month.** August's last daily run happens on 31
August at 06:00 UTC, so the stored August figure is short by the rest of that
day — every month, silently, and the number looks perfectly plausible. The
monthly line re-collects the closed month with `--period`, which is idempotent:
it rewrites the same row rather than adding one.

**The clock the month is measured in is UTC**, not the host's locale —
`currentPeriod()` reads `getUTCMonth()`. That is why the daily job does not run
late at night in Brazil: at 23:40 São Paulo time the UTC date has already
turned, so on the last night of a month the job would collect the *next* month
while Brazil is still finishing the current one.

Three details in that line were each wrong once, and none of them fails loudly:

- **`root`, not the site's own user.** Reaching the Docker socket is equivalent
  to root on the host, so the account that owns the site is deliberately kept
  out of the `docker` group. Running the job as that user gets
  `permission denied on the Docker socket` at 05:10 every day, into a log nobody
  reads.
- **`tsx` directly, not `npm run`.** The image carries `scripts/`, `lib/` and
  the resolved dependency graph — not a `package.json` whose scripts can be
  invoked.
- **`--conditions=react-server` belongs to `tsx`, not to `node`.** Placed before
  the binary, tsx respawns without it and `server-only` refuses the import.

It exits non-zero on failure, and — more importantly — writes the failure to the
connection row, which is what surfaces on `/novidades`. A routine that only
fails into a log is a routine that fails silently, and a connection that stops
working looks exactly like a month where nothing happened.

**`reach` counts unique accounts and is never summed across days.** Every figure
is requested from the API with the range it will be stored under. Adding seven
days of reach gives a plausible number that is simply too large, and nothing
would break.

One trap worth naming: the public field `media_repost_count` is a **repost**
count, not a share count. Measured against July's screenshots it read 1,986
where Insights showed 48,000 shares. It is stored in its own column and never
treated as the strong signal.

### Collecting

```bash
# 1. On instagram.com, logged in as the account, paste scripts/coletor-instagram.js
#    into the browser console and run:
#      await coletar('bianca.olivo')
#    A CSV downloads.

# 2. Import it. Safe to re-run — rows are keyed by the Instagram shortcode.
npm run db:import-reels -- ~/Downloads/reels-bianca.olivo-2026-08-05.csv
```

**Why the collector runs in a browser and not as a cron on the VPS.** These are
Instagram's internal endpoints, answering to a logged-in session and a browser
fingerprint; a request from a datacenter IP with no session is refused. And it
downloads a file rather than posting here because Instagram's CSP blocks
`connect-src` to any other origin — measured, not assumed.

**The importer never writes `reach`.** The public export has `views`, which
counts every loop of the video; reach is a different measurement only Insights
has. A reach copied from views would be a wrong denominator for every rate
computed afterwards, with nothing downstream looking broken.
`test/import.test.ts` asserts the invariant.

---

## Being told what happened

**This product sends no email.** Everything happens inside the platform, by
decision: a mail server nobody maintains is a dependency that fails quietly at
the worst moment, and a summary going to an unmonitored inbox is the same as no
summary.

**`/novidades`** is the consultant's activity screen — what each client marked,
uploaded, wrote or could not do since he last read it. A bell in the top bar
carries the unread count on a phone; on desktop it is the first rail item.

Three rules shape it:

- **Blocked and "could not get in" come first.** They are the only two that
  change what he does today. A step she could not finish is a problem with the
  instruction, not with her.
- **Only the client's own actions appear.** The consultant marking something is
  not news about the client, and the platform telling him what he just did is
  noise.
- **"Marcar como lido" moves the cut**, stored in `user.news_seen_at` — a
  separate column from `last_seen_at`, which advances on every sign-in and would
  mark everything read just for opening the app.

### Access, without email

There is no password-reset email, so a client who cannot get in has no
self-service path. Two things close that gap:

- The sign-in screen records the attempt, and it surfaces on `/novidades` as
  "não conseguiu entrar" — so the consultant learns about it without her having
  to remember to message him.
- **Conta → Quem tem acesso** mints a fresh link and copies it, to be
  relayed over whatever channel they already use. An invite link for someone who
  has never signed in (7 days), a reset link for someone who has (1 hour).
  Generating a new one invalidates the previous.

  The same section **adds a person to the client's team** — name, e-mail and
  what they do — and hands over their first link. Before this, a second person
  meant an SSH session: the account that owns the site is deliberately kept out
  of the `docker` group, so "give the assistant access" was a task one person
  could do at a computer and nowhere else. `npm run invite` is still the only
  way to create the FIRST account, since no screen can be reached before it.

The link is displayed as well as copied: `navigator.clipboard` needs a secure
context and does nothing over plain HTTP, so the copy can fail silently while
the feature still has to work.

Minting is consultant-only. An unauthenticated visitor able to mint one could
burn the pending link of someone mid-recovery just by typing their address.

For the very first account, before anyone can sign in:

```bash
npm run invite -- --email eu@dominio.com --name "Rodrigo" --consultant
```

It prints a link. Nothing is emailed.

---

## Production

```bash
cp .env.exemplo .env      # fill it in; DB_HOST=db
docker compose up -d --build
docker compose exec app node --env-file-if-exists=.env node_modules/.bin/tsx db/migrate.ts
```

The host's Nginx terminates TLS and proxies — a ready block sits in
`infra/nginx-myfavorite.conf`. Two lines there are not optional:

- `client_max_body_size 64m` — Insights screenshots reach 7 MB and Nginx
  defaults to 1 MB. Without it the upload fails with a 413 that never says where
  the limit came from.
- `proxy_request_buffering off` — with buffering on, Nginx stores the whole body
  before forwarding, and the progress bar on the client's screen sits at 100%
  while the server is still working.

The `db` service **publishes no port**. It talks to the app over Compose's
internal network; an exposed 3306 is the most common way to lose a database on a
VPS.

### Backup, and the restore that proves it

Two scripts, because a backup nobody has restored is a backup nobody has.

```bash
./infra/backup.sh                                  # dump + rsync dos arquivos
./infra/restore.sh backups/db-….sql.gz --para teste # restaura ao lado e confere
```

`backup.sh` grava em `./backups`, mantém 14 dias e **recusa um dump vazio**:
the pipe swallows mysqldump's error and gzip happily writes a valid 20-byte
file, so a backup that "exists" every day and works on none is the failure this
guards against.

`restore.sh --para <banco>` restaura num banco separado e compara tabela a
tabela contra o que está no ar. Sem `--para`, sobrescreve o banco em uso e por
isso pede o nome digitado como confirmação.

**A conferência usa `COUNT(*)`, não `information_schema.table_rows`.** Medido em
07/08/2026: `table_rows` é estimativa no InnoDB e mostrou `client 0`, `user 0`,
`step 0` para uma restauração perfeita — números que fariam qualquer um
concluir que o backup falhou. Um conferidor que erra é pior que nenhum, porque
é acreditado.

Ensaiado de ponta a ponta em 07/08/2026 contra o compose de produção: backup,
restauração em banco separado, 21 tabelas conferidas, todas batendo.

---

## Uploaded files

Written to `FILES_ROOT/<client_id>/<year>/<month>/<ulid>.<ext>`. The name the
browser sent lives **only in the database** and never touches the filesystem.
`SHA-256` is computed while writing, to catch a re-upload and prove integrity.

Nothing is served statically. An Nginx `alias` pointing at that folder would
expose the client's revenue and demographics on a guessable URL — downloads go
through a route that checks the session and the client scope.

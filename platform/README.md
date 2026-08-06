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
| `npm run invite -- --email … --name …` | Creates a user on `TENANT_SLUG` and prints an invite link (`--consultant` for an unscoped one) |
| `npm run digest -- --seco` | Prints the daily summary without sending |

---

## Database

Migrations live in `db/migrations/`, applied in alphabetical order, once each.
Bookkeeping is the `migration` table, created by the migrator itself.

**DDL in MySQL commits implicitly** — there is no transactional `CREATE TABLE`
migration. If a file fails midway, part of it has been applied and the
bookkeeping row is *not* written. The migrator stops there rather than moving
on. A new migration always lands as a new file; never edit one already applied.

### The six schema decisions worth knowing

1. **`user.client_id` NULL = consultant.** Set = that client's user. That is the
   whole access rule in one column, with no permission matrix.
2. **`step_status` has three states: `pending`, `done`, `blocked`.** The old HTML
   checkbox threw `blocked` away — which is exactly what you need to know.
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

Full detail in the comments of `db/migrations/001-initial-schema.sql` and
`003-pillars-and-copy-value.sql`.

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

| | |
|---|---|
| **Automatable** | views, likes, comments, caption, duration, date — per Reel |
| **Not automatable** | reach, saves, DM shares, video retention, profile visits, link clicks |

The second row is not an omission: those metrics do not exist in public data,
and they are the ones the cycle is decided on. `saves/reach` is the cycle's
decision metric and retention is an experiment's success criterion. They arrive
by Insights export or not at all.

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
- **Conta → Acesso dela** mints a fresh link and copies it, to be
  relayed over whatever channel they already use. An invite link for someone who
  has never signed in (7 days), a reset link for someone who has (1 hour).
  Generating a new one invalidates the previous.

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

### Backup

```bash
docker compose exec -T db mysqldump -uroot -p"$DB_ROOT_PASSWORD" \
  --single-transaction --routines myfavorite | gzip > backup-$(date +%F).sql.gz
```

Daily via cron, 14-day retention, plus an `rsync` of `FILES_HOST`.
**Restore once into an empty database and check the per-table row counts**
before the client is invited — an untested backup is one you have not lost yet.

---

## Uploaded files

Written to `FILES_ROOT/<client_id>/<year>/<month>/<ulid>.<ext>`. The name the
browser sent lives **only in the database** and never touches the filesystem.
`SHA-256` is computed while writing, to catch a re-upload and prove integrity.

Nothing is served statically. An Nginx `alias` pointing at that folder would
expose the client's revenue and demographics on a guessable URL — downloads go
through a route that checks the session and the client scope.

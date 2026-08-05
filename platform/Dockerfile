# =============================================================================
# Application image — multi-stage.
#
# The final stage carries only Next's `standalone` output: the server plus the
# dependencies it actually imports. Copying the whole `node_modules` would ship
# TypeScript, Vitest and everything else to the VPS for no reason.
# =============================================================================

FROM node:22-alpine AS base
# `libc6-compat` is what lets @node-rs/argon2's prebuilt binaries resolve
# against Alpine's musl. Without it the error only shows up at the first login.
RUN apk add --no-cache libc6-compat
WORKDIR /app


# ---- dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci


# ---- build ------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=UTC
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Does not run as root. If the upload route is ever exploited, the process that
# writes to disk must not be the one that can rewrite the application.
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

# Migration and seeding run from inside the container
# (`docker compose exec app`), so they need the TypeScript runtime and the .sql
# files.
COPY --from=build --chown=app:app /app/db ./db
COPY --from=deps  --chown=app:app /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps  --chown=app:app /app/node_modules/.bin/tsx ./node_modules/.bin/tsx

# The mount point exists before the bind mount, with the right owner.
RUN mkdir -p /var/lib/myfavorite/files && chown -R app:app /var/lib/myfavorite

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

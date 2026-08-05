# =============================================================================
# Imagem da aplicação — multi-estágio.
#
# O estágio final carrega só a saída `standalone` do Next: o servidor mais as
# dependências que ele de fato importa. Copiar `node_modules` inteiro levaria
# TypeScript, Vitest e tudo o mais para a VPS sem uso nenhum.
# =============================================================================

FROM node:22-alpine AS base
# `libc6-compat` é o que faz os binários pré-compilados do @node-rs/argon2
# resolverem na musl do Alpine. Sem ele o erro só aparece no primeiro login.
RUN apk add --no-cache libc6-compat
WORKDIR /app


# ---- dependências -----------------------------------------------------------
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

# Não roda como root. Se a rota de upload for explorada um dia, o processo que
# escreve no disco não pode ser o mesmo que pode reescrever a aplicação.
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

# Migração e semente rodam de dentro do contêiner (`docker compose exec app`),
# então precisam do runtime de TypeScript e dos arquivos .sql.
COPY --from=build --chown=app:app /app/banco ./banco
COPY --from=deps  --chown=app:app /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps  --chown=app:app /app/node_modules/.bin/tsx ./node_modules/.bin/tsx

# O ponto de montagem existe antes do bind mount, e com o dono certo.
RUN mkdir -p /var/lib/myfavorite/arquivos && chown -R app:app /var/lib/myfavorite

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

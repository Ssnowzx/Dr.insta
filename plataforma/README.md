# Plataforma

Aplicação web da consultoria: entregas com acompanhamento de etapas, recepção de
demandas, envio de arquivos e série histórica de métricas.

Substitui as páginas HTML avulsas publicadas na Vercel. O porquê, o escopo e as
alternativas descartadas estão em `openspec/changes/plataforma-cliente/`.

---

## Stack

| Camada | Escolha |
|---|---|
| Aplicação | Next.js 16 (App Router) · React 19 · TypeScript strict |
| Banco | MySQL 8.4 (compatível com MariaDB 11) · Drizzle ORM |
| Autenticação | Sessão em tabela · Argon2id · cookie `HttpOnly; Secure; SameSite=Lax` |
| Estilo | CSS com os tokens já aprovados pela cliente, sem framework |
| Gráficos | SVG renderizado no servidor, sem biblioteca |
| Infra | Docker Compose (app + db) atrás do Nginx do host |

Decisões e alternativas descartadas: `openspec/changes/plataforma-cliente/design.md`.

---

## Rodar na máquina local

Precisa de Docker e Node ≥ 20.19.

```bash
cd plataforma
cp .env.exemplo .env      # ajuste BANCO_HOST=127.0.0.1 e BANCO_PORTA=3307
npm install

# sobe só o MySQL, com a porta publicada em 127.0.0.1 (nunca em produção)
docker compose -f docker-compose.yml -f compose.dev.yml up -d db

npm run banco:migrar
npm run dev
```

`http://localhost:3000` deve informar quantas tabelas existem no esquema.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (saída `standalone`) |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run banco:migrar` | Aplica as migrações pendentes |
| `npm run banco:estado` | Lista o que já foi aplicado, sem alterar nada |
| `npm run banco:semear` | Carga inicial (Fase 3) |

---

## Banco

As migrações ficam em `banco/migracoes/`, aplicadas em ordem alfabética, uma vez
cada. O controle é a tabela `migracao`, criada pelo próprio migrador.

**DDL no MySQL faz commit implícito** — não existe migração transacional de
`CREATE TABLE`. Se um arquivo falhar no meio, parte dele ficou aplicada e o
registro *não* é gravado. O migrador para ali em vez de seguir para o próximo.
Migração nova sempre entra como arquivo novo; nunca edite um já aplicado.

### As quatro decisões do esquema que valem conhecer

1. **`usuario.cliente_id` NULL = consultor.** Preenchido = usuária daquele
   cliente. É a regra de acesso inteira em uma coluna, sem matriz de permissão.
2. **`etapa_status` tem três estados: `pendente`, `feito`, `travado`.** A caixa
   de marcar do HTML antigo jogava fora o `travado` — que é justamente o que
   interessa saber.
3. **`UNIQUE (cliente_id, metrica_def_id, competencia, granularidade, origem)`.**
   A mesma métrica chega do Insights e do GA4 com números diferentes; sobrescrever
   uma com a outra destruiria a divergência que precisa aparecer.
4. **`metrica_alvo.contaminado`** marca baseline que não serve para fixar meta.
   É a regra "baseline antes de meta" escrita em SQL.

Detalhe completo nos comentários de `banco/migracoes/001-esquema-inicial.sql`.

### Convenções

- Todo `DATETIME` é **UTC** — servidor em `--default-time-zone=+00:00` e driver
  em `timezone: 'Z'`. A renderização em `America/Sao_Paulo` é da aplicação.
- `DECIMAL` volta como **string** (`decimalNumbers: false`). Converter para
  `number` reintroduz ponto flutuante na coluna que guarda dinheiro.
- Razão é gravada como razão (`0.002300`), nunca como percentual formatado.
- Nada de exclusão física em tabela de trabalho: `arquivado_em` marca a saída.
- Toda consulta de domínio filtra por `cliente_id`.

---

## Produção

```bash
cp .env.exemplo .env      # preencha; BANCO_HOST=db
docker compose up -d --build
docker compose exec app node --env-file-if-exists=.env node_modules/.bin/tsx banco/migrar.ts
```

O Nginx do host faz TLS e proxy — bloco pronto em `infra/nginx-myfavorite.conf`.
Duas linhas de lá não são opcionais:

- `client_max_body_size 64m` — os prints de Insights chegam a 7 MB, e o padrão
  do Nginx é 1 MB. Sem isso o upload falha com um 413 que não diz de onde vem.
- `proxy_request_buffering off` — com o buffering ligado, o Nginx guarda o corpo
  inteiro antes de repassar, e o progresso na tela da cliente trava em 100%
  enquanto o servidor ainda está trabalhando.

O serviço `db` **não publica porta**. Ele fala com o app pela rede interna do
Compose; uma 3306 exposta é a forma mais comum de perder um banco em VPS.

### Backup

```bash
docker compose exec -T db mysqldump -uroot -p"$BANCO_SENHA_ROOT" \
  --single-transaction --routines myfavorite | gzip > backup-$(date +%F).sql.gz
```

Diário por cron, retenção de 14 dias, mais `rsync` de `ARQUIVOS_HOST`.
**Restaure uma vez num banco vazio e confira a contagem por tabela** antes de a
cliente entrar — backup não testado é backup que você ainda não perdeu.

---

## Arquivos enviados

Gravados em `ARQUIVOS_RAIZ/<cliente_id>/<ano>/<mes>/<ulid>.<ext>`. O nome que o
navegador mandou vive **só no banco** e nunca toca o sistema de arquivos.
`SHA-256` é calculado durante a escrita, para detectar reenvio e provar
integridade.

Nada é servido estaticamente. Um `alias` do Nginx apontando para essa pasta
exporia receita e demografia da cliente numa URL adivinhável — o download passa
por rota que confere sessão e `cliente_id`.

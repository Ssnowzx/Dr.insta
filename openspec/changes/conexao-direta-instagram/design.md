## Context

Ver `proposal.md — Why` para a motivação. O que importa aqui é o estado do
código que esta mudança encosta:

- `metric_value` tem chave única em `(client_id, metric_def_id, period,
  granularity, source)`. **Origens concorrentes já convivem por desenho** — é
  assim que `revenue` de julho existe duas vezes, `store` 10.583,28 e `manual`
  12.700.
- `lib/dashboard.ts:metrics()` faz `leftJoin` em `metric_value` filtrando
  `inArray(source, ['insights','ga4','store'])`. Com duas linhas casando, o join
  devolve **duas linhas para o mesmo `metric_def`** e a tela repete o cartão.
  Hoje não acontece porque `revenue` só tem uma origem medida; passa a acontecer
  no dia em que `api` entrar.
- `lib/origem.ts` já descreve procedência por origem e distingue medido de
  informado. Ganha um caso.
- Comandos administrativos são CLI + `docker compose exec`, não job embutido.
  `db:migrate`, `db:seed`, `invite`, `link` seguem esse padrão.
- O produto **não envia e-mail**. Qualquer aviso vive em `/novidades`.

Restrição externa que ordena o trabalho: o `redirect_uri` do OAuth exige HTTPS
em domínio real. Túnel resolve em desenvolvimento; a conexão dela depende da VPS.

## Goals / Non-Goals

**Goals**

- Uma credencial que sobrevive sozinha e cuja perda não vaza pelo banco.
- Coleta idempotente: rodar duas vezes não muda nada.
- Falha que aparece, porque o modo de falha esperado é silencioso.
- Zero dependência nova.

**Non-Goals de design** (além do que a proposta já exclui)

- Série diária. Esta leva grava granularidade mensal, que é o que as telas leem.
- Fila, retentativa com backoff, observabilidade externa. Uma conta, uma
  execução por dia.
- Múltiplas conexões por cliente. Uma conta por cliente, e o schema impõe.

## Decisions

### D1 — Business Login for Instagram, não Facebook Login

O fluxo antigo exige Página do Facebook vinculada e escopos `instagram_basic` /
`instagram_manage_insights`. O novo dispensa a Página e usa
`instagram_business_basic` + `instagram_business_manage_insights`.

**Alternativa considerada:** Facebook Login. Rejeitada porque acrescenta uma
Página do Facebook à conta dela como pré-requisito — trabalho de terceiro para
resolver um problema nosso.

### D2 — Credencial cifrada com AES-256-GCM do `node:crypto`

Chave de 32 bytes em `ENCRYPTION_KEY`, fora do banco. Persistir
`iv:authTag:ciphertext`. GCM e não CBC porque autentica: credencial adulterada
no banco falha ao decifrar em vez de virar lixo silencioso.

**Alternativas:** texto puro (rejeitada — um dump vira acesso à conta dela);
KMS gerenciado (rejeitada — infraestrutura que uma VPS única não tem).

**Consequência aceita:** perder `ENCRYPTION_KEY` é perder a conexão. Não há
recuperação, e não deve haver — ela reconecta em dois cliques. Fica escrito no
`.env.exemplo` para não ser redescoberto como bug.

**Sem dependência nova:** `node:crypto` faz AES-GCM.

### D3 — Prova anti-CSRF em cookie de uso único, não em tabela

O `state` vai num cookie `httpOnly`, `SameSite=Lax`, validade de 10 minutos,
apagado ao ser consumido. Lax basta porque o retorno é navegação GET de topo.

**Alternativa:** tabela `oauth_state`. Rejeitada — tabela, migração e rotina de
limpeza para um valor que vive 10 minutos e pertence a um navegador.

O `code` chega por query string. Ele é trocado por token e **nunca** é
registrado; a rota redireciona para uma URL limpa antes de renderizar qualquer
coisa, para não ficar no histórico dela.

### D4 — Precedência resolvida na leitura, em código

Ordem: **`api` > `store` > `ga4` > `insights` > `manual`**. `store` e `ga4`
medem o que a API do Instagram não mede, então na prática não competem com
`api`; a ordem existe para ser total e não depender de coincidência.

`metrics()` deixa de filtrar origem no `leftJoin` e passa a agrupar por
`metric_def` escolhendo a de maior precedência, guardando as descartadas para
a divergência exigida pelo spec.

**Alternativa:** resolver em SQL com `ROW_NUMBER()`. Rejeitada — são 17 métricas
por período, o ganho é nulo e a versão em código é testável sem banco.

### D5 — Coleta por range mensal, nunca por soma de dias

**`reach` é contas únicas.** Somar sete dias de alcance não dá o alcance da
semana — infla, porque quem viu na segunda e na quinta conta duas vezes. A API
aceita `since`/`until`, então cada métrica é pedida **com o range do período que
se quer gravar**, e a agregação nunca é feita em casa.

Isso vale mesmo para métricas que somariam corretamente (views, likes, saves):
uma regra só, sem exceção que alguém precise lembrar.

**Consequência:** o mês corrente é reescrito a cada execução, até fechar. É
idempotente por construção — a chave única em
`(client, metric_def, period, granularity, source)` faz a segunda gravação ser
um update.

### D6 — Rotina única, diária, via CLI e cron do host

`npm run sync:instagram` faz, em ordem: renova a credencial se faltar menos de
15 dias; coleta o mês corrente; coleta insights das mídias dos últimos 30 dias e
das que nunca tiveram; grava; atualiza `last_sync_at` ou `last_error`.

Renovar com 15 dias de folga e não na véspera: com execução diária, isso tolera
duas semanas de falha antes de a credencial morrer de vez.

**Alternativa:** job dentro do servidor Next. Rejeitada — morre no restart, não
tem log próprio e não dá para rodar à mão quando se quer conferir.

A janela de 30 dias existe para o custo da coleta não crescer com o acervo: são
205 Reels e uma chamada de insights por mídia. Post antigo não muda mais.

### D7 — Métricas mapeadas, e as que não têm par declarado

| `metric_def` | Origem na API | Observação |
|---|---|---|
| `reach` | `reach` (conta) | range mensal |
| `bio_link_clicks` | `profile_links_taps` | **o critério do experimento a1** |
| `likes_reach`, `comments_reach`, `saves_reach`, `sends_reach` | derivadas de `likes`/`comments`/`saves`/`shares` sobre `reach` | gravadas calculadas |
| `story_replies` | `replies` | |
| `reel_shares` | `shares`, recorte de mídia | |
| `followers_net` | `follows_and_unfollows` | |
| `views` | `views` | `impressions` está morto |
| `product_reel_retention` | `ig_reels_avg_watch_time` ÷ duração | média, não curva |
| `profile_visits` | **sem par em nível de conta** | segue `insights` manual |
| `tracked_sessions`, `transactions`, `revenue`, `conversion_rate` | fora da API | seguem `ga4` / `store` |

Métrica ausente na resposta **não vira zero** — o spec exige, e um zero
inventado em `bio_link_clicks` seria lido como experimento fracassado.

### D8 — A tela dela é onde a conexão vive

A cliente conecta e desconecta em `/conta`. É a tela que já fala de acesso e
credencial, e é dela a conta que está sendo autorizada. O consultor vê o estado
no mesmo lugar em que já vê o acesso dela.

## Risks / Trade-offs

- **Credencial morre em 60 dias sem renovar** → rotina diária com folga de 15
  dias; falha vira aviso em `/novidades` com "desde quando não há dado novo".
- **Coleta para em silêncio e os números só param de mudar** → é o modo de falha
  mais provável e o mais caro. `last_sync_at` é apresentado junto dos números, e
  `lib/freshness.ts` já sabe dizer idade de dado.
- **Soma indevida de `reach`** → D5. Um teste afirma que a coleta nunca soma
  períodos, porque o erro é invisível: produz número plausível e maior.
- **Cartão duplicado quando `api` entrar** → D4, com teste de duas origens para o
  mesmo período antes de a coleta existir.
- **Meta muda a API ou o app cai** → `insights` manual continua válido e a
  precedência degrada sozinha para ele. É o motivo de não remover a origem.
- **Limite de chamadas** → janela de 30 dias e uma execução por dia mantêm o
  volume na ordem de dezenas. O limite exato não foi confirmado na
  documentação; a rotina registra quantas chamadas fez, para medir antes de
  precisar.
- **Ela revoga a autorização pelo Instagram e não pela plataforma** → a próxima
  coleta falha com erro de autorização; o estado vira desconectado por esse
  caminho também, não só pelo botão.

## Migration Plan

1. Migração `005`: tabela `instagram_connection` e valor `api` no enum de
   `metric_value.source`. **Aditiva** — nada existente muda de significado.
2. Precedência em `lib/dashboard.ts` **antes** da coleta existir, com teste. A
   ordem importa: se a coleta chegar primeiro, a tela duplica cartão em
   produção.
3. OAuth e tela, validados por túnel HTTPS.
4. Coleta e rotina.
5. Conexão real dela — **depois da VPS**.

**Rollback:** parar o cron e desconectar. As linhas com origem `api` deixam de
ser escolhidas pela precedência assim que param de ser atualizadas, e o `insights`
manual volta a ser o valor apresentado. Nenhum dado anterior é destruído em
nenhum passo — a migração só adiciona.

## Open Questions

- **Limite exato de chamadas** da Instagram API por hora e por dia neste fluxo.
  Não muda o desenho — a janela de 30 dias já mantém o volume baixo — mas define
  se um dia dá para coletar Stories de hora em hora. A rotina conta as chamadas
  para responder isso com medição em vez de documentação.
- **Se `profile_visits` somado por mídia responde a mesma pergunta** que a
  métrica de conta do funil. Precisa comparar um mês em que temos os dois
  números; até lá, a linha segue manual.

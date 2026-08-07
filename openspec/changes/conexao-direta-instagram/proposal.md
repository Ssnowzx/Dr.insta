## Why

**Toda análise deste projeto depende de a Bianca lembrar de exportar um CSV.**
O `CLAUDE.md` registra a fonte de dados como "input manual / CSV exportado do
Insights (sem Graph API)", e o custo disso está visível no produto: dos cinco
pedidos abertos na tela dela, **quatro são só me mandar um dado**. O mais
antigo — a planilha dos 203 Reels — está aberto desde 5 de agosto e é descrito
como "o que mais destrava". Enquanto ele não chega, a leitura do ciclo não
fecha.

**Pior: o dado que decide o ciclo é justamente o que não temos.** O experimento
a1 trocou o link da bio por um com etiqueta, e a métrica que diz se funcionou é
cliques no link — hoje registrada como **0**, com baseline de 30/07/2026. Sem
coleta automática, esse número só existe se ela abrir o Insights, achar a tela
certa e transcrever. A API oficial entrega exatamente isso em
`profile_links_taps`, todo dia, sem pedir nada a ela.

**E a Meta mudou o que era caro nisso.** A *Instagram API with Instagram Login*
dispensa Página do Facebook, e em modo Desenvolvimento funciona por tempo
indeterminado para uma conta com papel de tester — **sem App Review, sem
verificação de negócio**. O que antes era projeto virou um botão e um cron.

## What Changes

- **Botão "Conectar meu Instagram" na área dela.** Fluxo Business Login for
  Instagram: ela clica, autoriza no próprio Instagram e volta conectada. Nenhum
  código copiado, nenhuma senha compartilhada, nenhuma conta de Facebook no
  meio.
- **Escopos só de leitura:** `instagram_business_basic` e
  `instagram_business_manage_insights`. Nada de publicar, nada de mensagens —
  decidido em 06/08/2026. Pedir poder que não usamos gasta confiança no exato
  momento em que ela decide clicar.
- **Token guardado cifrado**, com renovação automática. Token longo dura 60
  dias; renovado semanalmente, nunca cai. Passados 60 dias sem renovar, morre e
  não volta.
- **Coleta diária** que grava em `metric_value` com origem nova (`api`),
  distinta de `insights` — que passa a significar "alguém digitou olhando o
  app". Procedência mais forte, e a divergência entre as duas fica visível em
  vez de sumir.
- **BREAKING — precedência entre origens.** Com o mesmo número chegando por
  duas origens, a tela precisa escolher uma. Hoje `lib/dashboard.ts` faz
  `leftJoin` filtrando por origem medida, e duas linhas para a mesma
  métrica/período **duplicariam o cartão**. Passa a haver ordem explícita:
  `api` > `store`/`ga4` > `insights` > `manual`.
- **Falha que aparece.** Token expirado, autorização revogada ou coleta com erro
  viram aviso em `/novidades` e um estado visível na tela dela. Uma conexão que
  para de funcionar em silêncio é pior que nenhuma: os números simplesmente
  param de mudar e ninguém percebe.
- **Mudança do contexto fixo do projeto:** a fonte de dados primária deixa de
  ser export manual.

## Capabilities

### New Capabilities

- `conexao-instagram`: autorização da conta pela própria cliente, guarda e
  renovação de credencial, coleta periódica de métricas da API oficial, e o
  comportamento exigido quando a conexão falha ou é revogada.

### Modified Capabilities

- `plataforma-de-cliente`: a tela passa a ter estado de conexão que a cliente
  pode ver e resolver sozinha; e a regra de procedência — que hoje exige que
  todo número mostre de onde veio — ganha a ordem de precedência entre origens
  concorrentes para a mesma métrica e período.

## Impact

- **Schema:** tabela `instagram_connection`; valor `api` no enum
  `metric_value.source`; migração `005`.
- **Código novo:** `lib/instagram/` (OAuth, cliente da API, mapeamento de
  métricas), `app/(app)/conta/instagram/` e rota de callback,
  `scripts/sync-instagram.ts`.
- **Código alterado:** `lib/dashboard.ts` (precedência), `lib/digest.ts` (aviso
  de falha), `lib/origem.ts` (descrição da origem `api`).
- **Ambiente:** `IG_APP_ID`, `IG_APP_SECRET`, `ENCRYPTION_KEY` e cron no host.
  **Nenhuma dependência nova** — OAuth é `fetch`, cifra é `node:crypto`.
- **Dependência externa nova**, a primeira do produto: se a API da Meta mudar ou
  cair, a coleta para. O export manual continua funcionando como caminho de
  volta, e é por isso que a origem `insights` não é removida.
- **Bloqueio de ordem:** o `redirect_uri` exige HTTPS em domínio real. Dá para
  construir e testar tudo por túnel, mas a conexão dela só acontece com a VPS no
  ar.

## Fora de escopo

- **Publicar, agendar, comentar ou responder DM pela plataforma.** Exigiria
  escopos que decidimos não pedir agora.
- **Curva de retenção** ("até onde assistiram"). A API dá média
  (`ig_reels_avg_watch_time`), não a curva. O pedido de print dos nove vídeos
  continua de pé.
- **Visitas ao perfil em nível de conta.** Não existe como métrica de conta na
  API — só `profile_visits` por mídia. A linha do funil segue vindo do export
  até decidirmos se soma por post responde a mesma pergunta.
- **Stories.** Somem em 24h e exigiriam coleta de hora em hora; fica para
  quando o ciclo precisar deles.
- **Segunda cliente / App Review / Advanced Access.** Enquanto for uma conta com
  papel no app, modo Desenvolvimento basta.
- **GA4 e painel da loja.** Continuam manuais neste ciclo.

## Métrica observável

O sucesso desta mudança se lê em **`profile_links_taps` (cliques no link da
bio)** aparecendo na plataforma com origem `api`, sem intervenção dela, dentro
de 24h do primeiro clique real — hoje o valor é 0, com baseline de 30/07/2026,
e é o critério do experimento a1.

Como métrica de operação: **número de pedidos abertos do tipo "me mandar um
dado"**, hoje 4 de 5. A conexão deve encerrar os que dependem apenas de dados
que a API entrega.

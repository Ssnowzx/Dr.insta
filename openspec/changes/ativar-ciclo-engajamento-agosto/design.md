## Context

Ver `proposal.md` — Why. O que restringe o desenho:

- O banco já tem um ciclo ativo ("Caminho até a compra") com pilares, metas, experimentos,
  uma entrega publicada e 5 pedidos abertos. Em produção, a Bianca já tem login (nunca
  respondeu nada: `step_status` vazio em 06/08, Instagram ainda não conectado).
- O seed é a via de autoria: **o que o seed autora, o seed sobrescreve**; ids, public codes
  e o que uma pessoa fez no app ficam de fora. `request` ainda insere só-se-vazio — isso
  quebra para as perguntas novas, porque a tabela não está vazia.
- As telas resolvem o ciclo por `state='active'` (`activeCycle()`), mas o seed resolvia o
  próprio cycleId com `limit 1` sem filtro — com dois ciclos isso fica indeterminado.
- O painel abre com um funil hard-coded (reach → perfil → loja → compra) que é a tese do
  ciclo antigo, e cura métricas por `metric_def.tier` — `north_star` hoje é
  `tracked_sessions`.

## Goals / Non-Goals

**Goals:**

- Um comando (`db:seed`) leva um banco de qualquer estado (novo ou produção) ao estado
  pós-transição, sem tocar no que a cliente produziu.
- O ciclo antigo permanece legível como era — a pergunta "a aposta pagou?" continua
  respondível.
- O painel conta a tese do ciclo novo com números já medidos (nada inventado).

**Non-Goals:**

- Nenhuma migração de schema — a transição cabe nas tabelas existentes.
- Nenhuma tela nova — as perguntas usam o fluxo de pedidos que já existe.
- Não recalibrar o ciclo com as respostas dela (isso é revisão futura).

## Decisions

1. **Dois ciclos por título, não por `limit 1`.** O seed resolve cada ciclo por
   `(clientId, title)` — chave única que já existe. O antigo é autorado como `closed` com
   `endsOn: 2026-08-12`; o novo como `active`. Alternativa rejeitada: apagar/reescrever o
   ciclo antigo — destruiria o congelamento que o schema foi desenhado para dar.

2. **Experimentos do ciclo antigo: `abandoned` com desfecho, via seed.** O estado de
   experimento não tem escrita no app (nenhuma UI muda), então o seed é o autor legítimo.
   O desfecho aponta a decisão da cliente e o handoff.

3. **Entrega antiga arquivada, não deletada.** `archived_at` no upsert da entrega
   `cinco-ajustes`; `deliveries()` já filtra arquivadas. As respostas de `step_status`
   (hoje zero) permanecem.

4. **Painel: o funil sai; entra o contraste privado × público.** A tese do ciclo novo não
   é um funil — é "a conversa existe e está no lugar errado": 22 mil respostas de Stories
   contra 0,21% de comentários por alcance. Placa nova com os dois números, montada dos
   cartões que `metrics()` já devolve. Alternativa rejeitada: funil ciclo-aware — forçar
   engajamento num funil de compra conta a história errada. O componente `Funnel` e
   `funnel()` ficam no código (testados, inofensivos) — só saem da página.

5. **Curadoria por tier segue, com handoff explícito.** `comments_reach` vira
   `north_star`; `tracked_sessions` desce para `monitor` com descrição dizendo para onde
   foi. As métricas da loja saem do painel por lista explícita de chaves
   (`HANDED_OFF`), com comentário no código — não por deleção de dados: os valores
   continuam no banco e na história.

6. **Upserts passam a autorar tudo o que o arquivo autora.** `metric_def` (descrição,
   rótulos, unidade, tier) e `metric_target` (target, contaminated, note) ganham o mesmo
   tratamento já aplicado a cycle/step/pillar. É a regra existente aplicada onde faltou.

7. **Pedidos chaveados por título, com aposentadoria narrada.** O insert só-se-vazio vira
   verificação de existência por `(clientId, title)` linha a linha. O pedido do relatório
   da loja, se ainda `open` e sem interação, vira `dropped` + `request_event` narrando o
   motivo — aparece na linha do tempo do pedido, não some. As 5 perguntas novas entram
   ligadas ao ciclo novo. Alternativa rejeitada: UNIQUE em título — título é texto de
   tela, não chave; a verificação em código basta.

## Risks / Trade-offs

- [Re-seed em produção altera linhas vivas] → Regra de autoria respeitada (nada que ela
  produziu é tocado); backup ensaiado antes do re-seed (`infra/backup.sh`, restore já
  provado 21/21 tabelas).
- [As respostas dela às perguntas podem contradizer o desenho] → Fora de escopo aqui;
  vira revisão do ciclo com as respostas na mão. O desenho atual é o melhor dos dados.
- [Sem Insights conectado, a métrica-norte não é medível por post] → O plano põe a conexão
  como passo 1; até lá, proxy público rotulado. O painel mostra a barra com o valor de
  julho (amostra 6) e a nota de amostra visível.
- [Views podem cair com o mix novo] → Guard-rail escrito no ciclo e trade-off na tela do
  plano; a nota do painel aponta para ele.

## Migration Plan

1. Seed local → `npm run lint && npm test` na plataforma → conferir renderizado nos dois
   temas.
2. Commit + push; pull na VPS (espelho).
3. Backup manual antes do re-seed em produção; re-seed via
   `docker compose exec -T app node_modules/.bin/tsx --conditions=react-server --env-file-if-exists=.env db/seed.ts`.
4. Conferir no ar: painel, `/plano`, `/pedidos` (5 perguntas), ciclo antigo fechado.
5. Rollback: restaurar o dump (`infra/restore.sh`) — o seed não deleta nada, então o
   rollback real é só para o caso de escrita errada em massa.

## Open Questions

- Canal e momento do handoff para a equipe da My Favorite (decisão do usuário; o material
  fica pronto no repositório).

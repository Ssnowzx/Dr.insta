## Why

Em 13/08/2026 a Bianca respondeu nove pedidos e subiu dezesseis arquivos de uma vez. Do lado dela, os pedidos passaram a exibir **"em andamento"** — e vão exibir isso até alguém marcar entregue. Ela não tem como saber se o material chegou, se serviu, se está sendo lido ou se sumiu.

A causa está no modelo: `request.state` tem quatro valores e tenta responder **duas perguntas de duas pessoas** com uma coluna só.

- "eu já fiz a minha parte?" — respondida
- "e o que aconteceu com o que eu mandei?" — nunca respondida

Pior, `in_progress` dispara **sozinho** quando ela comenta ou sobe arquivo (`lib/request-actions.ts:127`). Um selo que acende no segundo do upload é indistinguível de "ninguém olhou", e ensina a ignorar o selo. E `delivered` é ambíguo: no digest dele lê "Fechou pedido", no dela lê "Te respondi" — o mesmo estado significando coisas opostas conforme quem o produziu.

Três problemas adjacentes, todos do mesmo tronco:

**Ninguém consegue abrir pedido no produto.** `insert(request)` só existe em `db/seed.ts:1124`. Os nove pedidos dela são os que foram semeados; qualquer rodada nova exige editar o seed e fazer deploy. Não é um ciclo de trabalho, é uma lista congelada.

**As telas não distinguem quem está lendo.** `/novidades` já bifurca por papel; `/pedidos` e o painel são **uma tela só, escrita na voz dela** ("O que falta de você"), servida igual para os dois. O consultor não tem fila de trabalho, e ela recebe números pensados para diagnóstico e não para decisão dela.

**Nada cobra o consultor.** Um pedido respondido que fica parado não aparece em lugar nenhum como dívida dele.

Ela declarou o que quer ver, e a ordem é dela: **seguidores → comentários e likes → views**, com "resultado e explicações". O painel hoje mostra a ordem do diagnóstico, não a dela.

## What Changes

- **BREAKING** — o ciclo de vida do pedido vira uma corrente com dono visível em cada etapa: `aberto → respondido → em análise → concluído`, mais `dispensado` como saída. Migração de enum: `in_progress` vira `answered`, `delivered` vira `concluded`, entra `analyzing`
- **"Em análise" é ação deliberada de quem recebeu**, nunca automática. É o único selo que promete atenção humana, e um selo automático que promete atenção é mentira
- **Concluir exige desfecho escrito.** Campo novo `request.outcome`, obrigatório para fechar. Pedido fechado sem explicação é pior que pedido aberto — foi exatamente o que aconteceu com os dezesseis arquivos
- **Os dois lados abrem pedido.** `raisedBySide` já existe no schema e nunca foi usado; passa a ser preenchido por um formulário nas duas pontas. O digest do consultor passa a mostrar pedido levantado por ela, que hoje ele não vê
- **Pedido respondido e parado vira dívida dele**: mais de 3 dias sem virar "em análise" aparece no Novidades do consultor
- **`/pedidos` e o painel bifurcam por papel**, como `/novidades` já faz. Ela vê o que precisa dela e o que voltou pra ela com resultado; ele vê fila de trabalho e o diagnóstico inteiro
- **O painel dela segue a ordem que ela declarou**, e cada número carrega uma linha de tradução em vez de uma taxa

## Capabilities

### New Capabilities

- `pedido-de-mao-dupla`: o ciclo de vida de um pedido — estados com dono declarado, quem pode movê-los, o desfecho obrigatório na conclusão, quem pode abrir, e quando um pedido parado vira dívida de quem o recebeu
- `leitura-por-papel`: o que cada lado vê do mesmo dado — a cliente lê resultado e explicação na ordem que ela declarou, o consultor lê diagnóstico e fila de trabalho, e nenhuma tela serve os dois com o mesmo texto

### Modified Capabilities

Nenhuma. `openspec/specs/` continua vazio — não há spec principal publicada.

## Impact

- `platform/db/schema.ts` — enum de `request.state` e coluna `outcome`; migração SQL própria
- `platform/lib/request-actions.ts` — transições, regra do desfecho obrigatório, `analyzing` manual, criação de pedido pelos dois lados
- `platform/lib/dashboard.ts` — `requests()` passa a receber o papel de quem lê; consultas novas de fila e de pedido parado
- `platform/lib/digest.ts` — pedido levantado por ela entra no digest do consultor; pedido parado entra como dívida
- `platform/app/(app)/pedidos/` — bifurcação por papel e tela de abertura de pedido
- `platform/app/(app)/page.tsx` — painel dela na ordem declarada, painel dele com o funil
- `platform/db/seed.ts` — os nove pedidos existentes migram para os estados novos com desfecho onde já houver
- `platform/test/` — testes das transições e da regra do desfecho
- Sem impacto em `src/` — o motor de métricas não participa

## Fora de escopo

- **Notificação fora do app.** Continua sem e-mail e sem push por decisão anterior; o sino e o Novidades seguem sendo o canal
- **Etapas dentro de "em análise".** Um estado só, decidido em 13/08: o detalhe vai no comentário que o consultor escreve dentro do pedido, porque texto livre comunica mais que um selo a mais
- **Prazo negociável por pedido.** O corte de 3 dias é fixo nesta versão; se virar incômodo, vira campo depois
- **O conteúdo do painel dela.** Quais números aparecem e com que tradução depende do ciclo vigente — sai da mudança `pivotar-ciclo-para-seguidores`, não desta. Aqui se define apenas que os painéis são distintos e quem manda na ordem
